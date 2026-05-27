import os
import sys
import json
import argparse
import re
import requests
from bs4 import BeautifulSoup
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone

try:
    from fastapi import FastAPI, HTTPException, Body
    from fastapi.middleware.cors import CORSMiddleware
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

try:
    import firebase_admin
    from firebase_admin import credentials, db as rtdb
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

# ══════════════════════════════════════════════
#  CONSTANTS & CONFIG
# ══════════════════════════════════════════════

BASE_URL = "https://eportal.maraugusthinosecollege.org"
# API key loaded from environment variable only (never hardcode in public repos)
DEFAULT_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

# We omit Brotli (br) from Accept-Encoding to prevent decompression failures in environments
# where the brotli python package is not compiled/installed.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
}

# ══════════════════════════════════════════════
#  CLOUDFLARE EMAIL DEOBFUSCATOR
# ══════════════════════════════════════════════

def deobfuscate_cloudflare_email(cfemail: str) -> str:
    """Decodes email obfuscated by Cloudflare protection."""
    try:
        key = int(cfemail[:2], 16)
        email_bytes = []
        for i in range(2, len(cfemail), 2):
            char_code = int(cfemail[i:i+2], 16) ^ key
            email_bytes.append(char_code)
        return bytes(email_bytes).decode('utf-8')
    except Exception:
        return ""

def process_obfuscated_emails(soup: BeautifulSoup):
    """Replaces obfuscated Cloudflare email links with plain text email values."""
    for a in soup.find_all("a", href=re.compile(r"email-protection")):
        cfemail = a.get("data-cfemail") or ""
        if cfemail:
            plain_email = deobfuscate_cloudflare_email(cfemail)
            if plain_email:
                a.replace_with(plain_email)
        else:
            # Fallback if hex is in href
            href = a.get("href", "")
            match = re.search(r"email-protection#([a-fA-F0-9]+)", href)
            if match:
                plain_email = deobfuscate_cloudflare_email(match.group(1))
                if plain_email:
                    a.replace_with(plain_email)

# ══════════════════════════════════════════════
#  GEMINI AI PARSER FALLBACK
# ══════════════════════════════════════════════

def clean_html_for_gemini(html_content: str) -> str:
    """Strips layout tags to reduce tokens and speed up Gemini parsing."""
    soup = BeautifulSoup(html_content, "lxml")
    process_obfuscated_emails(soup)
    
    # Decompose script, style, nav, footer, and media elements
    for element in soup(["script", "style", "meta", "link", "noscript", "svg", "iframe", "embed", "picture"]):
        element.decompose()
        
    body = soup.find("body")
    return str(body) if body else str(soup)

def gemini_parse_html(html_content: str, prompt: str, schema_description: str) -> Optional[Any]:
    """Uses Gemini API as a fallback parser to extract clean structured JSON."""
    api_key = os.environ.get("GEMINI_API_KEY", DEFAULT_GEMINI_KEY)
    if not api_key:
        print("Gemini API parsing skipped: No API key configured.")
        return None
        
    clean_html = clean_html_for_gemini(html_content)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    system_instruction = (
        "You are an expert data scraper. Extract structured information from the provided HTML/text. "
        f"Return ONLY valid JSON that conforms exactly to the following structure:\n{schema_description}\n"
        "Do not include code blocks, explanations, or comments. Return the raw JSON directly."
    )
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"HTML to parse:\n\n{clean_html}\n\nTask instructions:\n{prompt}"}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=25)
        if r.status_code == 200:
            res_json = r.json()
            text_response = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response.strip())
        else:
            print(f"Gemini API returned error {r.status_code}: {r.text}")
            return None
    except Exception as e:
        print(f"Gemini API call failed: {e}")
        return None

# ══════════════════════════════════════════════
#  UTILITY HELPERS
# ══════════════════════════════════════════════

def txt(el) -> str:
    """Safe stripped text extraction."""
    if not el:
        return ""
    # Process cloudflare emails inside this element first
    if hasattr(el, "find_all"):
        for a in el.find_all("a", href=re.compile(r"email-protection")):
            cfemail = a.get("data-cfemail") or ""
            if cfemail:
                plain_email = deobfuscate_cloudflare_email(cfemail)
                if plain_email:
                    a.replace_with(plain_email)
    return el.get_text(separator=" ", strip=True)

def get_asp_tokens(soup: BeautifulSoup) -> dict:
    """Extract hidden ASP.NET form variables."""
    tokens = {}
    for tid in ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__VIEWSTATEENCRYPTED"]:
        tag = soup.find("input", {"id": tid}) or soup.find("input", {"name": tid})
        tokens[tid] = tag.get("value", "") if tag else ""
    return tokens

def safe_get(session: requests.Session, url: str, timeout: int = 15) -> Optional[BeautifulSoup]:
    """Perform HTTP GET request and return parsed BeautifulSoup object."""
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 200:
            return BeautifulSoup(r.text, "lxml")
        return None
    except Exception as e:
        print(f"GET failed for {url}: {e}")
        return None

def parse_table_rows(table) -> list:
    """Parse generic HTML table rows into a list of dicts using the first row as headers."""
    if not table:
        return []
    rows = table.find_all("tr")
    if not rows:
        return []

    # Extract headers
    headers = [txt(th) for th in rows[0].find_all(["th", "td"])]
    if not headers:
        return []

    result = []
    for row in rows[1:]:
        cells = row.find_all("td")
        if not cells:
            continue
        row_data = {}
        for i, cell in enumerate(cells):
            key = headers[i] if i < len(headers) else f"col_{i}"
            row_data[key] = txt(cell)
        # Verify row is not entirely empty
        if any(v.strip() for v in row_data.values()):
            result.append(row_data)

    return result

def is_logged_in(soup: BeautifulSoup) -> bool:
    """Check if the session is authenticated (absence of password inputs)."""
    if soup is None:
        return False
    # If the page still contains a password input field, we are not logged in.
    if soup.find("input", {"type": "password"}):
        return False
    # If page contains standard portal logout link, we are authenticated
    if soup.find("a", href=re.compile(r"SignOut|Logout", re.I)):
        return True
    # Fallback checks
    title = soup.title.string.lower() if soup.title else ""
    if "login" in title:
        return False
    if soup.find(string=re.compile(r"MAR AUGUSTHINOSE|Dashboard|Academic", re.I)):
        return True
    return False

# ══════════════════════════════════════════════
#  FIREBASE REALTIME DATABASE HELPERS
# ══════════════════════════════════════════════

DEFAULT_FIREBASE_DB_URL = "https://machub-6af39-default-rtdb.asia-southeast1.firebasedatabase.app/"

def init_firebase() -> bool:
    """Initialize Firebase Admin SDK from env vars. Safe to call multiple times."""
    if not FIREBASE_AVAILABLE:
        return False
    if firebase_admin._apps:
        return True
    database_url = os.environ.get("FIREBASE_DATABASE_URL", DEFAULT_FIREBASE_DB_URL)
    service_account_json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    try:
        if service_account_json_str:
            cred = credentials.Certificate(json.loads(service_account_json_str))
            firebase_admin.initialize_app(cred, {"databaseURL": database_url})
        else:
            # Fallback: application default credentials (local dev with gcloud auth)
            firebase_admin.initialize_app(options={"databaseURL": database_url})
        print("✅ Firebase Admin initialized successfully.")
        return True
    except Exception as e:
        print(f"⚠️ Firebase Admin init failed: {e}")
        return False

def push_to_firebase(admission_no: str, data: dict):
    """Push scraped student data to Firebase Realtime Database."""
    if not init_firebase():
        print("⚠️ Firebase not available, skipping push.")
        return
    try:
        save_data = dict(data)
        save_data["last_synced"] = datetime.now(timezone.utc).isoformat()
        ref = rtdb.reference(f"/students/{admission_no}")
        ref.set(save_data)
        print(f"✅ Data pushed to Firebase for student {admission_no}")
    except Exception as e:
        print(f"⚠️ Firebase push failed: {e}")

def read_from_firebase(admission_no: str) -> Optional[dict]:
    """Read cached student data from Firebase Realtime Database."""
    if not init_firebase():
        return None
    try:
        ref = rtdb.reference(f"/students/{admission_no}")
        return ref.get()
    except Exception as e:
        print(f"⚠️ Firebase read failed: {e}")
        return None

def get_cache_age_minutes(cached_data: dict) -> float:
    """Returns how many minutes ago data was synced. Returns 9999 if unknown."""
    try:
        last_synced_str = cached_data.get("last_synced", "")
        if not last_synced_str:
            return 9999
        synced_at = datetime.fromisoformat(last_synced_str)
        if synced_at.tzinfo is None:
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - synced_at).total_seconds() / 60
        return round(age, 1)
    except Exception:
        return 9999

# ══════════════════════════════════════════════
#  SESSION MANAGER
# ══════════════════════════════════════════════

class MachinSession:
    """Manages the HTTP session, authentication, and token parsing."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(BROWSER_HEADERS)
        self.authenticated = False
        self.student_name = ""
        self.admission_no = ""

    def login(self, admission_no: str, password: str) -> bool:
        """Logs into EduloomPro portal. Returns True on success."""
        login_url = f"{BASE_URL}/Login.aspx"

        try:
            r = self.session.get(login_url, timeout=15)
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=502, detail="Portal unreachable.")
        except requests.exceptions.Timeout:
            raise HTTPException(status_code=504, detail="Request timed out.")

        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Portal returned HTTP {r.status_code}.")

        soup = BeautifulSoup(r.text, "lxml")
        tokens = get_asp_tokens(soup)

        # Detect inputs dynamically
        username_input = soup.find("input", {"type": "text"})
        password_input = soup.find("input", {"type": "password"})
        submit_btn = soup.find("input", {"type": "submit"})

        u_field = username_input.get("name", "txtusername") if username_input else "txtusername"
        p_field = password_input.get("name", "txtpassword") if password_input else "txtpassword"
        s_field = submit_btn.get("name", "Submit") if submit_btn else "Submit"
        s_val = submit_btn.get("value", "Login") if submit_btn else "Login"

        form = soup.find("form")
        action = form.get("action", "./Default.aspx?ReturnUrl=%2fLogin.aspx") if form else "./Default.aspx?ReturnUrl=%2fLogin.aspx"
        
        # Build action URL
        if action.startswith("."):
            post_url = BASE_URL + action.lstrip(".")
        elif action.startswith("/"):
            post_url = BASE_URL + action
        else:
            post_url = action

        payload = {
            "__VIEWSTATE": tokens.get("__VIEWSTATE", ""),
            "__VIEWSTATEGENERATOR": tokens.get("__VIEWSTATEGENERATOR", ""),
            "__EVENTVALIDATION": tokens.get("__EVENTVALIDATION", ""),
            u_field: admission_no,
            p_field: password,
            s_field: s_val
        }

        # Perform authentication POST
        try:
            res = self.session.post(post_url, data=payload, allow_redirects=True, timeout=15)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Login POST failed: {e}")

        # Double check authentication using Dashboard
        dash_soup = safe_get(self.session, f"{BASE_URL}/Dashboard.aspx")
        if not is_logged_in(dash_soup):
            return False

        # Extract student name from welcome block
        self.student_name = "Student"
        # Find candidate names in dashboard text
        text_lines = [l.strip() for l in dash_soup.get_text(separator="\n").split("\n") if l.strip()]
        for line in text_lines[:50]:
            # Look for lines containing student name in capital letters (from 5 to 50 chars)
            if 5 < len(line) < 40 and line.isupper() and line.replace(" ", "").isalpha() and "DASHBOARD" not in line and "EDULOOM" not in line:
                self.student_name = line
                break

        self.admission_no = admission_no
        self.authenticated = True
        return True

# ══════════════════════════════════════════════
#  INDIVIDUAL PAGE SCRAPING ROUTINES
# ══════════════════════════════════════════════

def scrape_dashboard(mac: MachinSession) -> dict:
    """Scrapes Dashboard.aspx for card counters and active course list."""
    soup = safe_get(mac.session, f"{BASE_URL}/Dashboard.aspx")
    if not soup:
        return {"error": "Failed to load Dashboard.aspx"}

    result = {
        "study_material": 0,
        "assessment": 0,
        "assignment": 0,
        "seminar": 0,
        "internal_mark": False,
        "feedback": False,
        "active_courses": [],
    }

    # Extract counters from layout
    card_labels = {
        "Study Material": "study_material",
        "Assessment": "assessment",
        "Assignment": "assignment",
        "Seminar": "seminar",
    }
    
    lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for label, key in card_labels.items():
            if label.lower() == line.lower():
                # Scan nearby lines for counters
                for offset in range(-3, 4):
                    idx = i + offset
                    if 0 <= idx < len(lines):
                        nums = re.findall(r"^\d+$", lines[idx])
                        if nums:
                            result[key] = int(nums[0])
                            break

    result["internal_mark"] = bool(soup.find(string=re.compile("Internal Mark", re.I)))
    result["feedback"] = bool(soup.find(string=re.compile("Feed Back", re.I)))

    # Parse Active Course table at the bottom
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue
        header = txt(rows[0]).lower()
        if "active programmes" in header or "slno" in header:
            # Found active courses table
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) < 2:
                    continue
                cell_text = txt(cells[1])
                if not cell_text or "no records" in cell_text.lower():
                    continue
                
                # Parse: "SEM 2 - Additional Subject Ds Lab (DSLAB)"
                sem_match = re.search(r"(SEM \d+)", cell_text)
                code_matches = re.findall(r"\(([^)]+)\)", cell_text)
                
                semester = sem_match.group(1) if sem_match else ""
                code = code_matches[-1] if code_matches else ""
                
                category = ""
                known_categories = [
                    "Skill Enhancement Courses (SEC)",
                    "Value Addition Courses (VAC)",
                    "Additional Subject",
                    "Core Course",
                    "AEC - OL",
                    "AEC",
                    "VAC"
                ]
                for cat in known_categories:
                    if cat.lower() in cell_text.lower():
                        category = cat
                        break
                
                # Subject name cleanup
                subject_name = cell_text
                if semester:
                    subject_name = subject_name.replace(semester, "")
                if code:
                    subject_name = subject_name.replace(f"({code})", "")
                if category:
                    subject_name = re.sub(re.escape(category), "", subject_name, flags=re.IGNORECASE)
                
                # Strip remaining dashes and spacing
                subject_name = re.sub(r"^\s*[-/|]\s*|\s*[-/|]\s*$", "", subject_name).strip()
                subject_name = re.sub(r"\s+", " ", subject_name)
                
                result["active_courses"].append({
                    "name": subject_name,
                    "code": code,
                    "semester": semester,
                    "category": category,
                    "raw_text": cell_text
                })
            break

    # If active_courses is empty but table exists, run Gemini Fallback
    if not result["active_courses"] and tables:
        schema = '[{"name": "string", "code": "string", "semester": "string", "category": "string", "raw_text": "string"}]'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract active courses table into a JSON list. Identify subject name, code in brackets, semester label, and course category.",
            schema
        )
        if ai_res and isinstance(ai_res, list):
            result["active_courses"] = ai_res

    return result


def scrape_profile(mac: MachinSession) -> dict:
    """Scrapes Profile.aspx for student details."""
    soup = safe_get(mac.session, f"{BASE_URL}/Profile.aspx")
    if not soup:
        return {"error": "Failed to load Profile.aspx"}

    result = {
        "name": mac.student_name,
        "admission_no": mac.admission_no,
        "course": "",
        "batch": "",
        "division": "",
        "semester": "",
        "email": "",
        "phone": "",
        "dob": "",
        "gender": "",
        "category": "",
        "nationality": "",
        "address": "",
        "guardian_name": "",
        "guardian_phone": "",
        "photo_url": "",
        "aadhar": "",
        "abc_id": "",
    }

    # Extract obfuscated email
    process_obfuscated_emails(soup)

    # Line-by-line scanner extraction
    lines = [l.strip() for l in soup.get_text(separator="\n").split("\n") if l.strip()]
    
    # Split into student and parent sections to prevent fields overwriting each other
    student_lines = []
    parent_lines = []
    in_parent = False
    for line in lines:
        if any(p in line.lower() for p in ["father info", "mother info", "guardian info"]):
            in_parent = True
        if in_parent:
            parent_lines.append(line)
        else:
            student_lines.append(line)

    # Pre-parse name, course, batch from student lines
    for i, line in enumerate(student_lines[:30]):
        if "view student profile" in line.lower() and i + 1 < len(student_lines):
            result["name"] = student_lines[i+1]
            if i + 3 < len(student_lines):
                result["course"] = student_lines[i+3]
            for offset in range(3, 8):
                if i + offset < len(student_lines) and re.search(r"\d{4}\s*-\s*\d{4}", student_lines[i+offset]):
                    result["batch"] = student_lines[i+offset]
                    break

    for i, line in enumerate(student_lines):
        lower_line = line.lower()
        if "date of birth" in lower_line and i + 1 < len(student_lines):
            result["dob"] = student_lines[i+1]
        elif lower_line == "mobile" and i + 1 < len(student_lines):
            result["phone"] = student_lines[i+1]
        elif lower_line == "email" and i + 1 < len(student_lines):
            result["email"] = student_lines[i+1]
        elif lower_line == "gender" and i + 1 < len(student_lines):
            result["gender"] = student_lines[i+1]
        elif "aadhaar" in lower_line and i + 1 < len(student_lines):
            result["aadhar"] = student_lines[i+1]
        elif lower_line == "nationality" and i + 1 < len(student_lines):
            if student_lines[i+1].lower() not in ("other details", "religion"):
                result["nationality"] = student_lines[i+1]
        elif lower_line == "reservation" and i + 1 < len(student_lines):
            result["category"] = student_lines[i+1]
        elif lower_line == "permanent address" and i + 1 < len(student_lines):
            result["address"] = student_lines[i+1]
        elif lower_line == "abc id" and i + 1 < len(student_lines):
            result["abc_id"] = student_lines[i+1]

    # Parse parent info
    for i, line in enumerate(parent_lines):
        lower_line = line.lower()
        if "father info" in lower_line:
            for j in range(1, 10):
                if i + j >= len(parent_lines) or any(m in parent_lines[i+j].lower() for m in ["mother info", "guardian info"]):
                    break
                if parent_lines[i+j].lower() == "name" and i + j + 1 < len(parent_lines):
                    result["guardian_name"] = parent_lines[i+j+1]
                if parent_lines[i+j].lower() == "phone" and i + j + 1 < len(parent_lines):
                    result["guardian_phone"] = parent_lines[i+j+1]

    # Photo image
    photo = soup.find("img", id=re.compile(r"photo|profile|student", re.I)) or soup.find("img", src=re.compile(r"student", re.I))
    if photo and photo.get("src"):
        src = photo["src"]
        result["photo_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"

    # Verify if important fields are missing, fallback to Gemini AI
    if not result["dob"] or not result["phone"] or not result["address"]:
        schema = '{"name": "string", "admission_no": "string", "course": "string", "batch": "string", "division": "string", "semester": "string", "email": "string", "phone": "string", "dob": "string", "gender": "string", "category": "string", "nationality": "string", "address": "string", "guardian_name": "string", "guardian_phone": "string", "aadhar": "string", "abc_id": "string"}'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract student profile fields: name, course, batch, email, phone, DOB, gender, Aadhaar, permanent address, and Father's details.",
            schema
        )
        if ai_res and isinstance(ai_res, dict):
            # Update fields that were extracted
            for k, v in ai_res.items():
                if v:
                    result[k] = v

    return result


def scrape_study_material(mac: MachinSession) -> list:
    """Scrapes StudyMeterialSubjectListNew.aspx for subjects."""
    soup = safe_get(mac.session, f"{BASE_URL}/StudyMeterialSubjectListNew.aspx")
    if not soup:
        return [{"error": "Failed to load StudyMeterialSubjectListNew.aspx"}]

    subjects = []
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [txt(th).lower() for th in rows[0].find_all(["th", "td"])]
        if "subject" not in "".join(headers):
            continue

        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            
            # Identify columns
            subject_cell = None
            view_link = ""
            
            for i, cell in enumerate(cells):
                cell_text = txt(cell)
                header_name = headers[i] if i < len(headers) else ""
                if "subject" in header_name or "programme" in header_name or not header_name:
                    if not subject_cell or len(cell_text) > len(txt(subject_cell)):
                        subject_cell = cell
                
                a = cell.find("a")
                if a and a.get("href"):
                    href = a["href"]
                    view_link = href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
            
            if subject_cell:
                full_text = txt(subject_cell)
                # Parse subject name and code from parentheses e.g. "Data Structures (MG2CCRBCA101)"
                code_match = re.search(r"\(([^)]+)\)", full_text)
                code = code_match.group(1) if code_match else ""
                
                # Strip code first
                text_no_code = re.sub(r"\s*\([^)]+\)", "", full_text).strip()
                
                # Parse semester e.g. "SEM 2"
                sem_match = re.search(r"(SEM \d+)", text_no_code)
                semester = sem_match.group(1) if sem_match else "SEM 2"
                
                # Parse category after '|'
                category = "Core Course"
                if "|" in text_no_code:
                    parts = text_no_code.split("|")
                    category = parts[1].strip()
                    subject_part = parts[0].replace(semester, "").strip()
                else:
                    subject_part = text_no_code.replace(semester, "").strip()
                
                # Cleanup subject name
                name = re.sub(r"^\s*[-/|]\s*|\s*[-/|]\s*$", "", subject_part).strip()
                name = re.sub(r"\s+", " ", name)
                
                subjects.append({
                    "name": name,
                    "code": code,
                    "semester": semester,
                    "category": category,
                    "view_url": view_link
                })

    # AI Fallback
    if not subjects and tables:
        schema = '[{"name": "string", "code": "string", "semester": "string", "category": "string", "view_url": "string"}]'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract all subject modules listed, including subject name, code in brackets, semester label, category, and view button link URL.",
            schema
        )
        if ai_res and isinstance(ai_res, list):
            subjects = ai_res

    return subjects


def scrape_assessment(mac: MachinSession) -> list:
    """Scrapes StdAssessmentNew.aspx for internal marks."""
    soup = safe_get(mac.session, f"{BASE_URL}/StdAssessmentNew.aspx")
    if not soup:
        return [{"error": "Failed to load StdAssessmentNew.aspx"}]

    assessments = []
    tables = soup.find_all("table")

    for table in tables:
        # Find closest heading preceding the table
        heading = ""
        sibling = table.find_previous_sibling()
        while sibling:
            cand = sibling.find(["h3", "h4", "h5", "b", "strong"]) or sibling
            cand_text = txt(cand)
            if cand_text and len(cand_text) > 4 and not cand_text.isdigit():
                heading = cand_text
                break
            sibling = sibling.find_previous_sibling()

        if not heading:
            h = table.find_previous(["h3", "h4", "h5"])
            heading = txt(h) if h else "Unknown Subject"

        # Cleanup heading (remove code in bracket to keep subject name clean)
        subject_name = re.sub(r"\s*\([^)]+\)", "", heading).strip()

        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        headers = [txt(th).lower() for th in rows[0].find_all(["th", "td"])]
        
        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            
            record = {
                "subject": subject_name,
                "assessment_type": "",
                "score": "",
                "max_mark": "",
                "pass_mark": "",
                "status": ""
            }
            
            for i, cell in enumerate(cells):
                h_name = headers[i] if i < len(headers) else f"col_{i}"
                val = txt(cell)
                
                if "type" in h_name or "assessment" in h_name or "exam" in h_name:
                    record["assessment_type"] = val
                elif "score" in h_name or "mark" in h_name or "obtained" in h_name:
                    record["score"] = val
                elif "max" in h_name or "total" in h_name:
                    record["max_mark"] = val
                elif "pass" in h_name:
                    record["pass_mark"] = val
                elif "status" in h_name or "result" in h_name or "p/f" in h_name or "pass" in h_name:
                    record["status"] = val

            # Fill up missing keys dynamically based on column count if names differ
            if not record["assessment_type"] and len(cells) >= 5:
                record["assessment_type"] = txt(cells[0])
                record["score"] = txt(cells[1])
                record["max_mark"] = txt(cells[2])
                record["pass_mark"] = txt(cells[3])
                record["status"] = txt(cells[4])

            if any(v.strip() for k, v in record.items() if k != "subject"):
                assessments.append(record)

    # AI Fallback
    if not assessments and tables:
        schema = '[{"subject": "string", "assessment_type": "string", "score": "string", "max_mark": "string", "pass_mark": "string", "status": "string"}]'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract all subject assessment tables into a JSON list. Link each assessment row (like Internal I, Model) to its subject heading.",
            schema
        )
        if ai_res and isinstance(ai_res, list):
            assessments = ai_res

    return assessments


def scrape_assignment(mac: MachinSession) -> dict:
    """Scrapes Assignment.aspx for assignments."""
    soup = safe_get(mac.session, f"{BASE_URL}/Assignment.aspx")
    if not soup:
        return {"error": "Failed to load Assignment.aspx", "active": [], "expired": []}

    result = {"active": [], "expired": []}
    tables = soup.find_all("table")
    
    # Match Active and Expired assignment tables
    # Typo on portal: "Exprired"
    for i, table in enumerate(tables):
        rows_data = parse_table_rows(table)
        
        # Determine active or expired from surrounding headers/tab panels
        txt_context = txt(table.find_parent())
        if "expr" in txt_context.lower() or "expire" in txt_context.lower() or i > 0:
            result["expired"].extend(rows_data)
        else:
            result["active"].extend(rows_data)

    return result


def scrape_seminar(mac: MachinSession) -> dict:
    """Scrapes Seminar.aspx for seminars."""
    soup = safe_get(mac.session, f"{BASE_URL}/Seminar.aspx")
    if not soup:
        return {"error": "Failed to load Seminar.aspx", "active": [], "expired": []}

    result = {"active": [], "expired": []}
    tables = soup.find_all("table")
    
    for i, table in enumerate(tables):
        rows_data = parse_table_rows(table)
        txt_context = txt(table.find_parent())
        if "expr" in txt_context.lower() or "expire" in txt_context.lower() or i > 0:
            result["expired"].extend(rows_data)
        else:
            result["active"].extend(rows_data)

    return result


def scrape_internal_to_university(mac: MachinSession) -> list:
    """Scrapes StdInterenalNew.aspx for MGU submitted internal marks."""
    soup = safe_get(mac.session, f"{BASE_URL}/StdInterenalNew.aspx")
    if not soup:
        return [{"error": "Failed to load StdInterenalNew.aspx"}]

    marks = []
    tables = soup.find_all("table")
    for table in tables:
        heading = table.find_previous(["h3", "h4", "h5", "b", "strong"])
        subject = txt(heading) if heading else "Unknown"
        rows_data = parse_table_rows(table)
        for row in rows_data:
            row["subject"] = subject
            marks.append(row)

    # AI Fallback
    if not marks and tables:
        schema = '[{"subject": "string", "components": "object/string", "mark": "string"}]'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract MGU university internal marks table. Associate each row's marks with its subject heading.",
            schema
        )
        if ai_res and isinstance(ai_res, list):
            marks = ai_res

    return marks


def scrape_hall_ticket(mac: MachinSession) -> dict:
    """Scrapes HallTicket.aspx for exam hall tickets."""
    soup = safe_get(mac.session, f"{BASE_URL}/HallTicket.aspx")
    if not soup:
        return {"error": "Failed to load HallTicket.aspx", "status": "Not available", "pdf_url": None, "details": []}

    result = {
        "status": "Not available",
        "pdf_url": None,
        "details": []
    }

    # Find PDF link or embed
    pdf_link = soup.find("a", href=re.compile(r"\.pdf", re.I))
    iframe = soup.find("iframe")
    embed = soup.find("embed")

    if pdf_link and pdf_link.get("href"):
        href = pdf_link["href"]
        result["pdf_url"] = href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
        result["status"] = "Available"
    elif iframe and iframe.get("src"):
        src = iframe["src"]
        result["pdf_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"
        result["status"] = "Available"
    elif embed and embed.get("src"):
        src = embed["src"]
        result["pdf_url"] = src if src.startswith("http") else f"{BASE_URL}/{src.lstrip('/')}"
        result["status"] = "Available"

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            result["details"] = rows
            result["status"] = "Available"
            break

    return result


def scrape_allotment_memo(mac: MachinSession) -> dict:
    """Scrapes adm_AllotmentMemo.aspx for allotment memo data."""
    possible_urls = [
        f"{BASE_URL}/adm_AllotmentMemo.aspx",
        f"{BASE_URL}/AllotmentMemo.aspx",
        f"{BASE_URL}/Allotment.aspx",
    ]
    
    soup = None
    final_url = ""
    for url in possible_urls:
        soup = safe_get(mac.session, url)
        if soup and is_logged_in(soup) and "resource cannot be found" not in soup.get_text().lower():
            final_url = url
            break

    if not soup:
        return {"url": f"{BASE_URL}/adm_AllotmentMemo.aspx", "pdf_url": None, "data": None, "error": "Not Found"}

    result = {
        "url": final_url,
        "pdf_url": None,
        "data": None
    }

    # Search for PDF links
    pdf_link = soup.find("a", href=re.compile(r"\.pdf", re.I))
    if pdf_link and pdf_link.get("href"):
        href = pdf_link["href"]
        result["pdf_url"] = href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            result["data"] = rows
            break

    return result


def scrape_online_exams(mac: MachinSession) -> list:
    """Scrapes OnlineExamNEW.aspx for online exam schedule."""
    soup = safe_get(mac.session, f"{BASE_URL}/OnlineExamNEW.aspx")
    if not soup:
        return []

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            return rows
    return []


def scrape_fyugp_courses(mac: MachinSession) -> list:
    """Scrapes StudentCourse_Selection.aspx for FYUGP elective selections."""
    soup = safe_get(mac.session, f"{BASE_URL}/StudentCourse_Selection.aspx")
    if not soup:
        return []

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            return rows
    return []


def scrape_exam_results(mac: MachinSession) -> list:
    """Scrapes ExamResult.aspx for university results."""
    soup = safe_get(mac.session, f"{BASE_URL}/ExamResult.aspx")
    if not soup:
        return []

    results = []
    tables = soup.find_all("table")
    for table in tables:
        heading = table.find_previous(["h3", "h4", "h5", "b", "strong"])
        subject = txt(heading) if heading else "Unknown"
        rows_data = parse_table_rows(table)
        for row in rows_data:
            row["subject"] = subject
            results.append(row)
            
    # AI Fallback
    if not results and tables:
        schema = '[{"subject": "string", "marks": "string", "grade": "string", "status": "string"}]'
        ai_res = gemini_parse_html(
            str(soup),
            "Extract published exam results. Link each row's grade/score with its subject heading.",
            schema
        )
        if ai_res and isinstance(ai_res, list):
            results = ai_res

    return results


def scrape_attendance(mac: MachinSession) -> list:
    """Scrapes AttendanceNew.aspx for attendance details."""
    soup = safe_get(mac.session, f"{BASE_URL}/AttendanceNew.aspx")
    if not soup:
        return []

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            return rows
            
    # AI Fallback
    if not tables:
        # Try parent page AttendanceMenu.aspx
        soup = safe_get(mac.session, f"{BASE_URL}/AttendanceMenu.aspx")
        if soup:
            schema = '[{"subject": "string", "percentage": "string", "attended": "string", "total": "string"}]'
            ai_res = gemini_parse_html(
                str(soup),
                "Extract subject attendance percentages from the page.",
                schema
            )
            if ai_res and isinstance(ai_res, list):
                return ai_res
                
    return []


def scrape_fee_payment(mac: MachinSession) -> list:
    """Scrapes StudFeePayment.aspx for payment records."""
    soup = safe_get(mac.session, f"{BASE_URL}/StudFeePayment.aspx")
    if not soup:
        return []

    tables = soup.find_all("table")
    for table in tables:
        rows = parse_table_rows(table)
        if rows:
            return rows
    return []

# ══════════════════════════════════════════════
#  MASTER SYNC ENGINE
# ══════════════════════════════════════════════

def perform_sync(admission_no: str, password: str) -> dict:
    """Performs full page-by-page scraping sync. Authenticates dynamically."""
    mac = MachinSession()
    
    # 1. Login
    if not mac.login(admission_no, password):
        raise HTTPException(status_code=401, detail="Invalid admission number or password.")

    # 2. Page-by-page scraping with individual try-except blocks
    try:
        dashboard = scrape_dashboard(mac)
    except Exception as e:
        dashboard = {"error": str(e)}

    try:
        profile = scrape_profile(mac)
    except Exception as e:
        profile = {"error": str(e)}

    try:
        subjects = scrape_study_material(mac)
    except Exception as e:
        subjects = [{"error": str(e)}]

    try:
        assessments = scrape_assessment(mac)
    except Exception as e:
        assessments = [{"error": str(e)}]

    try:
        assignments = scrape_assignment(mac)
    except Exception as e:
        assignments = {"error": str(e), "active": [], "expired": []}

    try:
        seminars = scrape_seminar(mac)
    except Exception as e:
        seminars = {"error": str(e), "active": [], "expired": []}

    try:
        internal_marks_university = scrape_internal_to_university(mac)
    except Exception as e:
        internal_marks_university = [{"error": str(e)}]

    try:
        hall_ticket = scrape_hall_ticket(mac)
    except Exception as e:
        hall_ticket = {"error": str(e), "status": "Not available", "pdf_url": None, "details": []}

    try:
        allotment_memo = scrape_allotment_memo(mac)
    except Exception as e:
        allotment_memo = {"url": "", "pdf_url": None, "data": None, "error": str(e)}

    try:
        online_exams = scrape_online_exams(mac)
    except Exception as e:
        online_exams = [{"error": str(e)}]

    try:
        fyugp_courses = scrape_fyugp_courses(mac)
    except Exception as e:
        fyugp_courses = [{"error": str(e)}]

    try:
        exam_results = scrape_exam_results(mac)
    except Exception as e:
        exam_results = [{"error": str(e)}]

    try:
        attendance = scrape_attendance(mac)
    except Exception as e:
        attendance = [{"error": str(e)}]

    try:
        fee_payment = scrape_fee_payment(mac)
    except Exception as e:
        fee_payment = [{"error": str(e)}]

    # 3. Build response
    response = {
        "status": "success",
        "_source": "fresh",
        "meta": {
            "admission_no": admission_no,
            "student_name": mac.student_name,
            "portal": BASE_URL,
            "sync_engine": "Machin v3.0"
        },
        "dashboard": dashboard,
        "profile": profile,
        "subjects": subjects,
        "assessments": assessments,
        "assignments": assignments,
        "seminars": seminars,
        "internal_marks_university": internal_marks_university,
        "hall_ticket": hall_ticket,
        "allotment_memo": allotment_memo,
        "online_exams": online_exams,
        "fyugp_courses": fyugp_courses,
        "exam_results": exam_results,
        "attendance": attendance,
        "fee_payment": fee_payment
    }

    # 4. Push to Firebase Realtime Database (non-blocking best-effort)
    try:
        push_to_firebase(admission_no, response)
    except Exception as e:
        print(f"⚠️ Firebase push skipped: {e}")

    return response

# ══════════════════════════════════════════════
#  FASTAPI APPLICATION DEFINITIONS & SCHEMAS
# ══════════════════════════════════════════════

if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="Machin Scraper Backend Engine",
        description="FastAPI Backend Scraper for EduloomPro / MAC Ramapuram College Portal",
        version="3.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class AuthRequest(BaseModel):
        admission_no: str = Field(..., description="College Admission Number")
        password: str = Field(..., description="College Portal Password")

    @app.get("/health")
    def health():
        """Health check endpoint."""
        return {"status": "online"}

    @app.post("/api/sync")
    def api_sync(payload: AuthRequest):
        """Full data sync across all 14 student pages."""
        return perform_sync(payload.admission_no, payload.password)

    @app.post("/api/dashboard")
    def api_dashboard(payload: AuthRequest):
        """Dashboard counters only (fast sync)."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_dashboard(mac)

    @app.post("/api/assessments")
    def api_assessments(payload: AuthRequest):
        """Assessments / Internal marks data."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_assessment(mac)

    @app.post("/api/subjects")
    def api_subjects(payload: AuthRequest):
        """Study Materials subjects list."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_study_material(mac)

    @app.post("/api/attendance")
    def api_attendance(payload: AuthRequest):
        """Subject-wise attendance data."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_attendance(mac)

    @app.post("/api/assignments")
    def api_assignments(payload: AuthRequest):
        """Active & Expired Assignments list."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_assignment(mac)

    @app.post("/api/profile")
    def api_profile(payload: AuthRequest):
        """Student Profile data."""
        mac = MachinSession()
        if not mac.login(payload.admission_no, payload.password):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        return scrape_profile(mac)

    @app.post("/api/data")
    def api_smart_data(payload: AuthRequest):
        """
        SMART endpoint — returns cached Firebase data instantly if fresh (<15 min).
        Falls back to live scrape only if data is stale or missing.
        This is the RECOMMENDED endpoint for the Machin app to use.
        """
        # Try to serve from Firebase cache first
        cached = read_from_firebase(payload.admission_no)
        if cached:
            age = get_cache_age_minutes(cached)
            if age < 15:
                cached["_source"] = "cache"
                cached["_cache_age_minutes"] = age
                return cached
        # Cache miss or stale — scrape fresh and push to Firebase
        return perform_sync(payload.admission_no, payload.password)

    @app.get("/api/cached/{admission_no}")
    def api_get_cached(admission_no: str):
        """
        Read-only: returns whatever is currently cached in Firebase for this student.
        Does NOT trigger a scrape. Returns 404 if no cached data exists.
        Use this for ultra-fast instant loads from the app.
        """
        cached = read_from_firebase(admission_no)
        if not cached:
            raise HTTPException(status_code=404, detail="No cached data found for this student. Call /api/data first.")
        cached["_source"] = "cache"
        cached["_cache_age_minutes"] = get_cache_age_minutes(cached)
        return cached

    @app.get("/api/firebase_status")
    def api_firebase_status():
        """Check if Firebase Realtime Database connection is working."""
        ok = init_firebase()
        return {
            "firebase_available": FIREBASE_AVAILABLE,
            "firebase_connected": ok,
            "database_url": os.environ.get("FIREBASE_DATABASE_URL", DEFAULT_FIREBASE_DB_URL)
        }

# ══════════════════════════════════════════════
#  STANDALONE CLI ENTRYPOINT
# ══════════════════════════════════════════════

def run_cli():
    parser = argparse.ArgumentParser(description="Machin ERP Scraper Standalone Command Line Tool")
    parser.add_argument("--adm", required=True, help="Admission Number")
    parser.add_argument("--pwd", required=True, help="Portal Password")
    parser.add_argument("--section", default="sync", choices=[
        "sync", "dashboard", "profile", "subjects", "assessments", "assignments", "seminars", "attendance"
    ], help="Target section to extract")
    parser.add_argument("--out", help="Output file path to save JSON result")

    args = parser.parse_args()

    print(f"Connecting to portal on behalf of Admission No: {args.adm}...")
    try:
        mac = MachinSession()
        if not mac.login(args.adm, args.pwd):
            print("ERROR: Invalid credentials. Login failed.")
            sys.exit(1)
            
        print(f"Logged in successfully. Student Name: {mac.student_name}")
        
        result = None
        if args.section == "sync":
            result = perform_sync(args.adm, args.pwd)
        elif args.section == "dashboard":
            result = scrape_dashboard(mac)
        elif args.section == "profile":
            result = scrape_profile(mac)
        elif args.section == "subjects":
            result = scrape_study_material(mac)
        elif args.section == "assessments":
            result = scrape_assessment(mac)
        elif args.section == "assignments":
            result = scrape_assignment(mac)
        elif args.section == "seminars":
            result = scrape_seminar(mac)
        elif args.section == "attendance":
            result = scrape_attendance(mac)

        json_out = json.dumps(result, indent=2)
        if args.out:
            with open(args.out, "w") as f:
                f.write(json_out)
            print(f"Extraction completed. Saved to {args.out}")
        else:
            print("\n=== EXTRACTED DATA ===")
            print(json_out)
            
    except Exception as e:
        print(f"ERROR: Scraper run failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # If arguments are passed, run in CLI mode
    if len(sys.argv) > 1 and not sys.argv[1].endswith(".py") and "--reload" not in "".join(sys.argv):
        run_cli()
    else:
        # Otherwise run as FastAPI server using uvicorn
        if FASTAPI_AVAILABLE:
            import uvicorn
            print("Starting FastAPI Scraper Server...")
            uvicorn.run("machin_scraper:app", host="0.0.0.0", port=8000, reload=True)
        else:
            print("ERROR: FastAPI packages not found. Run standard CLI mode by passing arguments:")
            print("  python machin_scraper.py --adm YOUR_ADM_NO --pwd YOUR_PASSWORD")
