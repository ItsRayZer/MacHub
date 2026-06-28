/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Scraper Module — Per-page scraper functions             ║
 * ║   Each function: fetches the portal page, detects session        ║
 * ║   expiry, and passes HTML to the parser module.                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import * as cheerio from 'cheerio';
import { parseHtml } from './parser.js';
import { isLoginPage } from './auth.js';
import { SPECS } from './specs.js';

const BASE_URL = SPECS.baseUrl;

/** Standard portal headers for all page requests */
const PORTAL_HEADERS = (cookie) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Referer': `${BASE_URL}/Dashboard.aspx`,
  'Host': 'eportal.maraugusthinosecollege.org',
  'Cookie': cookie,
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
});

/**
 * Generic page scraper — fetches and parses a page.
 * Throws 'SESSION_EXPIRED' if the response is a login page.
 * Throws 'PAGE_NOT_FOUND' for 404.
 * Throws 'PORTAL_ERROR' for other server errors.
 */
export async function scrapePage(pageName, path, cookie) {
  const url = `${BASE_URL}${path}`;
  console.log(`[Scraper] Fetching ${pageName}: ${url}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: PORTAL_HEADERS(cookie),
    redirect: 'manual',
  });

  // Session expiry detection: 302 redirect to login
  if (res.status === 302) {
    const loc = res.headers.get('location') || '';
    if (loc.toLowerCase().includes('login') || loc.toLowerCase().includes('default.aspx')) {
      throw new Error('SESSION_EXPIRED');
    }
    // Follow redirect manually
    const redirectRes = await fetch(
      loc.startsWith('http') ? loc : `${BASE_URL}${loc}`,
      { method: 'GET', headers: PORTAL_HEADERS(cookie), redirect: 'follow' }
    );
    const redirectHtml = await redirectRes.text();
    if (isLoginPage(redirectHtml)) throw new Error('SESSION_EXPIRED');
    return parseHtml(pageName, redirectHtml);
  }

  if (res.status === 404) {
    throw new Error(`PAGE_NOT_FOUND: ${path}`);
  }

  if (res.status >= 500) {
    throw new Error(`PORTAL_ERROR: HTTP ${res.status} on ${path}`);
  }

  const html = await res.text();

  // Session expiry detection: login page served as 200
  if (isLoginPage(html)) {
    throw new Error('SESSION_EXPIRED');
  }

  return parseHtml(pageName, html);
}

export async function scrapeSemesterDropdownPage(pageName, path, cookie, body) {
  const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
  const url = path;
  const requestHeaders = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Host": "eportal.maraugusthinosecollege.org",
    "Referer": PORTAL_BASE + "/Dashboard.aspx"
  };

  const getResponse = await fetch(PORTAL_BASE + url, { method: "GET", headers: requestHeaders, redirect: "manual" });
  if (getResponse.status === 302) throw new Error("SESSION_EXPIRED");
  const getHtml = await getResponse.text();
  if (getHtml.includes("btnLogin") || getHtml.includes("txtUser")) throw new Error("SESSION_EXPIRED");

  const $ = cheerio.load(getHtml);
  
  const semesterOptions = [];
  let semesterFieldName = "";
  let portalDefaultSem = null;
  
  $("select").each((_, el) => {
    const name = $(el).attr("name") || "";
    if (name.toLowerCase().includes("sem") || name.toLowerCase().includes("exam") || name.toLowerCase().includes("ddl")) {
      semesterFieldName = name;
    }
    $(el).find("option").each((_, opt) => {
      const value = $(opt).attr("value");
      const text = $(opt).text().trim();
      if (value && text) {
        semesterOptions.push({ value, text, selected: false });
        if ($(opt).prop("selected") || $(opt).attr("selected")) portalDefaultSem = value;
      }
    });
  });

  if (!semesterFieldName || semesterOptions.length === 0) {
    return parseHtml(pageName, getHtml);
  }

  let targetSemester = body?.semester || null;
  if (!targetSemester) {
    let maxVal = -1;
    let maxSemVal = "";
    semesterOptions.forEach(opt => {
      const numericVal = parseInt(opt.value, 10);
      if (!isNaN(numericVal) && numericVal > maxVal) { maxVal = numericVal; maxSemVal = opt.value; }
    });
    targetSemester = maxSemVal || portalDefaultSem || semesterOptions[0]?.value || "2";
  }

  if (!semesterOptions.find(o => o.value == targetSemester)) {
    return parseHtml(pageName, getHtml);
  }

  semesterOptions.forEach(opt => opt.selected = (opt.value === targetSemester));

  const finalPayload = helperExtractFormFields($);
  finalPayload[semesterFieldName] = targetSemester;
  finalPayload["__EVENTTARGET"] = semesterFieldName;
  finalPayload["__EVENTARGUMENT"] = "";
  
  delete finalPayload["ctl00$MainContent$btnSubmit"];
  delete finalPayload["ctl00$MainContent$btn_Cancel"];
  delete finalPayload["ctl00$MainContent$btnsubmit"];

  const bodyParams = new URLSearchParams();
  for (const [k, v] of Object.entries(finalPayload)) bodyParams.append(k, v);

  let postPath = url;
  const form = $("input[name='__VIEWSTATE']").closest("form");
  if (form.length && form.attr("action")) {
    const actionAttr = form.attr("action").trim();
    if (actionAttr && actionAttr !== "#") {
      if (actionAttr.startsWith("./")) postPath = "/" + actionAttr.substring(2);
      else if (actionAttr.startsWith("/")) postPath = actionAttr;
      else if (!actionAttr.startsWith("http")) {
        const lastSlash = url.lastIndexOf("/");
        postPath = (lastSlash >= 0 ? url.substring(0, lastSlash) : "") + "/" + actionAttr;
      }
    }
  }

  const postHeaders = { ...requestHeaders, "Content-Type": "application/x-www-form-urlencoded" };
  const postResponse = await fetch(PORTAL_BASE + postPath, { method: "POST", headers: postHeaders, body: bodyParams.toString() });
  
  let postHtml = await postResponse.text();
  if (postHtml.includes("btnLogin") || postHtml.includes("txtUser")) throw new Error("SESSION_EXPIRED");

  if (postHtml.includes('|updatePanel|')) {
    const parts = parseUpdatePanelDelta(postHtml);
    const htmlParts = parts.filter(p => p.type === 'updatePanel').map(p => p.content).join('');
    if (htmlParts) postHtml = `<html><body>${htmlParts}</body></html>`;
  }

  const parsed = parseHtml(pageName, postHtml);
  parsed.semesters = semesterOptions;
  parsed.semesterOptions = semesterOptions;
  return parsed;
}

// ═══════════════════════════════════════════════════════════════
//  PER-SECTION SCRAPERS
// ═══════════════════════════════════════════════════════════════

export const scrapeProfile = (adm, cookie) =>
  scrapePage('Profile', SPECS.sectionEndpoints.Profile, cookie);

export const scrapeDashboard = (adm, cookie) =>
  scrapePage('Dashboard', SPECS.sectionEndpoints.Dashboard, cookie);

export const scrapeStudyMaterial = (adm, cookie) =>
  scrapePage('StudyMaterial', SPECS.sectionEndpoints.StudyMaterial, cookie);

export const scrapeAssessment = (adm, cookie, body) =>
  scrapeSemesterDropdownPage('Assessment', SPECS.sectionEndpoints.Assessment, cookie, body);

export const scrapeAssignment = (adm, cookie) =>
  scrapePage('Assignment', SPECS.sectionEndpoints.Assignment, cookie);

export const scrapeSeminar = (adm, cookie) =>
  scrapePage('Seminar', SPECS.sectionEndpoints.Seminar, cookie);

function helperExtractFormFields($) {
  const payload = {};
  $('input, select, textarea').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    const type = $(el).attr('type');
    const val = $(el).val();

    if (type === 'checkbox' || type === 'radio') {
      if ($(el).prop('checked')) {
        payload[name] = val || 'on';
      }
    } else {
      payload[name] = val || '';
    }
  });
  return payload;
}

/**
 * Parses ASP.NET UpdatePanel delta response.
 * Format: length|type|id|content|...|
 * We extract the updatePanel content for the main data panel.
 */
function parseUpdatePanelDelta(deltaText) {
  const parts = [];
  let i = 0;
  while (i < deltaText.length) {
    // Read length
    const pipeIdx = deltaText.indexOf('|', i);
    if (pipeIdx === -1) break;
    const lengthStr = deltaText.substring(i, pipeIdx);
    const length = parseInt(lengthStr, 10);
    i = pipeIdx + 1;

    // Read type
    const pipeIdx2 = deltaText.indexOf('|', i);
    if (pipeIdx2 === -1) break;
    const type = deltaText.substring(i, pipeIdx2);
    i = pipeIdx2 + 1;

    // Read id
    const pipeIdx3 = deltaText.indexOf('|', i);
    if (pipeIdx3 === -1) break;
    const id = deltaText.substring(i, pipeIdx3);
    i = pipeIdx3 + 1;

    // Read content of exactly `length` characters
    const content = deltaText.substring(i, i + length);
    i = i + length + 1; // +1 to skip the trailing '|'

    parts.push({ type, id, content });
  }
  return parts;
}

async function postAttendanceForm(url, cookie, semesterValue) {
  const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
  const fullUrl = PORTAL_BASE + url;

  // Exact modern desktop Chrome network fingerprint
  const requestHeaders = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Host": "eportal.maraugusthinosecollege.org",
    "Referer": PORTAL_BASE + "/Dashboard.aspx",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
  };

  // ── STEP 1: GET INITIAL ENGINE STATE ────────────────────────────────
  const getResponse = await fetch(fullUrl, {
    method: "GET",
    headers: requestHeaders,
    redirect: "manual",
  });

  if (getResponse.status === 302) {
    throw new Error("SESSION_EXPIRED");
  }

  const getHtml = await getResponse.text();
  if (isLoginPage(getHtml) || getHtml.includes("btnLogin") || getHtml.includes("txtUser")) {
    throw new Error("SESSION_EXPIRED");
  }

  const $ = cheerio.load(getHtml);

  // Extract all existing inputs, dropdowns and fields
  const finalPayload = helperExtractFormFields($);

  // Locate the precise dynamic ASP.NET identifier for the DropDownList
  let semesterFieldName = "";
  $("select").each((_, el) => {
    const name = $(el).attr("name") || "";
    if (name.toLowerCase().includes("sem")) {
      semesterFieldName = name;
    }
  });
  if (!semesterFieldName) semesterFieldName = "ctl00$MainContent$ddlsem"; // Fallback architecture

  // Set the target semester dropdown value
  finalPayload[semesterFieldName] = semesterValue;




  // Brute-force student ID detection and propagation
  const stdId = $("#MainContent_hid_student").val() || 
                $("#MainContent_hdstdid").val() || 
                $("input[name*='student']").val() || 
                $("input[name*='stdid']").val();

  if (stdId && stdId !== "0") {
    Object.keys(finalPayload).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("student") || lowerKey.includes("stdid")) {
        const currentVal = String(finalPayload[key]).trim();
        if (currentVal === "0" || currentVal === "" || currentVal === "undefined") {
          finalPayload[key] = stdId;
        }
      }
    });
    // Ensure explicit common names are set to stdId
    const commonKeys = ["ctl00$MainContent$hid_student", "ctl00$MainContent$hdstdid", "ctl00$MainContent$hidsemsub"];
    commonKeys.forEach(k => {
      const v = String(finalPayload[k] || '').trim();
      if (v === "" || v === "0") finalPayload[k] = stdId;
    });
  }

  // Determine form action URL if specified
  let postPath = url;
  const form = $("input[name='__VIEWSTATE']").closest("form");
  if (form.length && form.attr("action")) {
    const actionAttr = form.attr("action").trim();
    if (actionAttr && actionAttr !== "#") {
      if (actionAttr.startsWith("./")) {
        postPath = "/" + actionAttr.substring(2);
      } else if (actionAttr.startsWith("/")) {
        postPath = actionAttr;
      } else if (!actionAttr.startsWith("http")) {
        const lastSlash = url.lastIndexOf("/");
        const dir = lastSlash >= 0 ? url.substring(0, lastSlash) : "";
        postPath = dir + "/" + actionAttr;
      } else {
        try {
          const urlObj = new URL(actionAttr);
          postPath = urlObj.pathname + urlObj.search;
        } catch (e) {}
      }
    }
  }

  // ── STEP 2: ASP.NET UPDATEPANEL AJAX POST ────────────────────────────
  // The attendance pages use UpdatePanel. We must send the partial-page
  // postback format with X-MicrosoftAjax:Delta=true so the server returns
  // the UpdatePanel delta (which contains the actual data table HTML).
  // Without this, the server returns the empty shell page.

  // Locate submit button name for the ScriptManager field
  const submitBtnName = $("input[type='submit']").first().attr("name") || "ctl00$MainContent$btnsubmit";
  finalPayload[submitBtnName] = "Submit";
  finalPayload["__EVENTTARGET"] = "";
  finalPayload["__EVENTARGUMENT"] = "";

  // ScriptManager control path for the UpdatePanel trigger
  // Format: ctl00$ScriptManager1=<UpdatePanelId>|<SubmitButtonName>
  finalPayload["ctl00$ScriptManager1"] = `ctl00$UpdatePanel3|${submitBtnName}`;
  finalPayload["__ASYNCPOST"] = "true";

  const encodedPayload = new URLSearchParams(finalPayload).toString();

  const postResponse = await fetch(PORTAL_BASE + postPath, {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://eportal.maraugusthinosecollege.org",
      "Referer": fullUrl,
      "X-MicrosoftAjax": "Delta=true",
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "*/*",
    },
    body: encodedPayload,
    redirect: "manual",
  });

  if (postResponse.status === 302) {
    throw new Error("SESSION_EXPIRED");
  }

  const rawResponse = await postResponse.text();
  if (isLoginPage(rawResponse) || rawResponse.includes("btnLogin") || rawResponse.includes("txtUser")) {
    throw new Error("SESSION_EXPIRED");
  }

  // If UpdatePanel delta response, extract updatePanel HTML fragment
  // Delta format: num|updatePanel|id|html|num|hiddenField|id|value|...
  if (rawResponse.includes('|updatePanel|') || rawResponse.startsWith('pageRedirect')) {
    const parts = parseUpdatePanelDelta(rawResponse);
    // Collect all updatePanel content pieces
    const htmlParts = parts
      .filter(p => p.type === 'updatePanel')
      .map(p => p.content)
      .join('');
    // Also collect hiddenFields to keep VIEWSTATE consistent
    if (htmlParts) {
      return `<html><body>${htmlParts}</body></html>`;
    }
  }

  // Fallback: full page response (shouldn't happen but handle gracefully)
  return rawResponse;
}

export const scrapeAttendanceDetails = async (admissionNumber, cookie, body, requestedSemester = null) => {
  try {
    const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
    // ─── Phase 1: Do a GET+POST via postAttendanceForm using default semester value
    // postAttendanceForm internally does:
    //   1. GET /AttendanceNew.aspx  → extract __VIEWSTATE tokens + semester options
    //   2. POST to form action (/AttendanceDetails.aspx) → get actual data table
    // We need the semester options BEFORE selecting, so: GET first, pick semester, then POST.

    // Step 1: GET the initial page to read semester options
    const initRes = await fetch(PORTAL_BASE + "/AttendanceNew.aspx", {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Host": "eportal.maraugusthinosecollege.org",
        "Referer": PORTAL_BASE + "/Dashboard.aspx",
      },
      redirect: "manual",
    });

    if (initRes.status === 302) throw new Error("SESSION_EXPIRED");
    const initHtml = await initRes.text();
    if (isLoginPage(initHtml)) throw new Error("SESSION_EXPIRED");

    const $init = cheerio.load(initHtml);
    const semesterOptions = [];
    let portalDefaultSem = "";

    $init("select option").each((_, el) => {
      const value = $init(el).attr("value");
      const text  = $init(el).text().trim();
      const isSelected = $init(el).prop("selected") || $init(el).attr("selected");
      if (value && text) {
        semesterOptions.push({ value, text, selected: false });
        if (isSelected) portalDefaultSem = value;
      }
    });

    // Smart semester selection: explicit > body.semester > highest numeric value (most recent) > portal default
    let targetSemester = requestedSemester || body?.semester || null;
    if (!targetSemester) {
      let maxVal = -1;
      let maxSemVal = "";
      semesterOptions.forEach(opt => {
        const numericVal = parseInt(opt.value, 10);
        if (!isNaN(numericVal) && numericVal > maxVal) {
          maxVal = numericVal;
          maxSemVal = opt.value;
        }
      });
      targetSemester = maxSemVal || portalDefaultSem || semesterOptions[0]?.value || "2";
    }
    semesterOptions.forEach(opt => { opt.selected = (opt.value === targetSemester); });

    // Step 2: POST using extracted tokens (postAttendanceForm does its own GET+POST)
    // We re-use postAttendanceForm which re-GETs internally to get fresh VIEWSTATE
    // This is the correct behaviour — the VIEWSTATE must match the POST target
    const html = await postAttendanceForm("/AttendanceNew.aspx", cookie, targetSemester);
    const $ = cheerio.load(html);
    const records = [];
    let dataTable = null;

    // DETERMINISTIC SCAN: find data table by content keywords
    // Last match wins — gets the innermost/most-specific data table
    $("table").each((_, el) => {
      const tableText = $(el).text();
      if (tableText.includes("1st Hour") || tableText.includes("2nd Hour") ||
          tableText.includes("Date") && tableText.includes("SL")) {
        dataTable = $(el);
      }
    });

    if (!dataTable || !dataTable.length) {
      return {
        success: true,
        page: "AttendanceDetails",
        sections: [],
        semesters: semesterOptions,
        message: "No attendance log table found. The portal returned an empty response after form post.",
        debug: { targetSemester, htmlLength: html.length }
      };
    }

    // Extract headers from first row that contains "Date" or "1st Hour"
    const headers = [];
    dataTable.find("tr").each((_, row) => {
      if (headers.length > 0) return;
      const cells = $(row).find("th, td");
      const sampleText = cells.text();
      if (sampleText.includes("Date") || sampleText.includes("1st Hour")) {
        cells.each((_, cell) => headers.push($(cell).text().trim()));
      }
    });

    // Process data rows
    dataTable.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (!cells.length) return;

      const rowData = {};
      let hasMeaningfulData = false;

      cells.each((i, cell) => {
        const key = headers[i] || `col_${i}`;
        if (key === `col_${i}`) return;
        const cellText = $(cell).text().trim();
        rowData[key] = cellText;
        if (cellText) hasMeaningfulData = true;

        // Detect absence via red color style
        if (key.toLowerCase().includes("hour") || key.toLowerCase().includes("b2")) {
          let status = "present";
          const cellHtml = $(cell).html() || "";
          if (cellHtml.includes("color:Red") || cellHtml.includes("color: red") ||
              cellHtml.includes('color="Red"') || $(cell).find("[style*='red'], [style*='Red']").length) {
            status = "absent";
          } else if (cellHtml.includes("color:Orange") || cellHtml.includes("color: orange") ||
                     cellText.toLowerCase().includes("special")) {
            status = "special";
          }
          rowData[`${key}_status`] = status;
        }
      });

      if (hasMeaningfulData && (rowData["SL"] || rowData["Date"])) {
        records.push(rowData);
      }
    });

    return {
      success: true,
      page: "AttendanceDetails",
      sections: [{ headers, rows: records }],
      data: records,
      semesters: semesterOptions,
      semesterOptions: semesterOptions,
      meta: { totalLogCount: records.length, activeSemesterEvaluated: targetSemester }
    };

  } catch (err) {
    if (err.message === "SESSION_EXPIRED") throw err;
    return { success: false, page: "AttendanceDetails", error: err.message, sections: [] };
  }
};

export const scrapeAttendanceSubjectWise = async (admissionNumber, cookie, body, requestedSemester = null) => {
  try {
    const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";

    // Step 1: GET the subject-wise page to read semester options
    const initRes = await fetch(PORTAL_BASE + "/AttendanceDetails_New.aspx", {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Host": "eportal.maraugusthinosecollege.org",
        "Referer": PORTAL_BASE + "/Dashboard.aspx",
      },
      redirect: "manual",
    });

    if (initRes.status === 302) throw new Error("SESSION_EXPIRED");
    const initHtml = await initRes.text();
    if (isLoginPage(initHtml)) throw new Error("SESSION_EXPIRED");

    const $init = cheerio.load(initHtml);
    const semesterOptions = [];
    let portalDefaultSem = "";

    $init("select option").each((_, el) => {
      const value = $init(el).attr("value");
      const text  = $init(el).text().trim();
      const isSelected = $init(el).prop("selected") || $init(el).attr("selected");
      if (value && text) {
        semesterOptions.push({ value, text, selected: false });
        if (isSelected) portalDefaultSem = value;
      }
    });

    // Smart semester selection: explicit > body.semester > highest numeric value (most recent) > portal default
    let targetSemester = requestedSemester || body?.semester || null;
    if (!targetSemester) {
      let maxVal = -1;
      let maxSemVal = "";
      semesterOptions.forEach(opt => {
        const numericVal = parseInt(opt.value, 10);
        if (!isNaN(numericVal) && numericVal > maxVal) {
          maxVal = numericVal;
          maxSemVal = opt.value;
        }
      });
      targetSemester = maxSemVal || portalDefaultSem || semesterOptions[0]?.value || "2";
    }
    semesterOptions.forEach(opt => { opt.selected = (opt.value === targetSemester); });

    // Step 2: POST to get subject-wise data (postAttendanceForm does its own GET+POST)
    const html = await postAttendanceForm("/AttendanceDetails_New.aspx", cookie, targetSemester);
    const $ = cheerio.load(html);
    const subjects = [];
    let dataTable = null;

    // DETERMINISTIC SCAN: find subject summary table
    $("table").each((_, el) => {
      const tableText = $(el).text();
      if (tableText.includes("Subjects") || tableText.includes("No. of Sessions") || tableText.includes("Total %")) {
        dataTable = $(el);
      }
    });

    if (!dataTable || !dataTable.length) {
      return {
        success: true,
        page: "AttendanceSubjectWise",
        sections: [],
        semesters: semesterOptions,
        debug: { targetSemester, htmlLength: html.length }
      };
    }

    const headers = [];
    dataTable.find("tr").each((_, row) => {
      if (headers.length > 0) return;
      const cells = $(row).find("th, td");
      if (cells.text().includes("Subjects") || cells.text().includes("Sessions")) {
        cells.each((_, cell) => headers.push($(cell).text().trim().toLowerCase()));
      }
    });

    dataTable.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (!cells.length) return;

      const rowData = {};
      cells.each((i, cell) => {
        const key = headers[i] || `col_${i}`;
        rowData[key] = $(cell).text().trim();
      });

      const subjectTitle = rowData["subjects"] || rowData["subject"] || rowData["subject name"] || rowData["programme"] || rowData[headers[0]] || "";
      if (!subjectTitle || subjectTitle.toLowerCase().includes("subjects") || subjectTitle.toLowerCase().includes("total")) return;

      const sessions = parseFloat(rowData["no. of sessions"] || rowData["total"] || rowData["total hours"] || rowData["conducted"] || rowData["col_3"] || "0");
      const present  = parseFloat(rowData["no. of present"] || rowData["present"] || rowData["present hours"] || rowData["col_2"] || "0");
      const absent = parseFloat(rowData["no. of absent"] || rowData["absent"] || "0");
      const odAttendance = rowData["od attendance"] || rowData["od"] || "0";
      const medical = rowData["medical"] || "0";
      let percentageText = rowData["total %"] || rowData["total%"] || rowData["%"] || rowData["percentage"] || rowData["pct"] || "";
      if (!percentageText && sessions > 0) {
        percentageText = ((present / sessions) * 100).toFixed(2) + "%";
      }

      const cleanPct = parseFloat(percentageText);
      subjects.push({
        subject: subjectTitle,
        subjectName: subjectTitle,
        Subjects: subjectTitle,
        sessions: sessions,
        totalHours: String(sessions),
        "No. of Sessions": String(sessions),
        present: present,
        presentHours: String(present),
        "No. of Present": String(present),
        absent: absent,
        absentHours: String(absent),
        "No. of Absent": String(absent),
        odAttendance: odAttendance,
        od: odAttendance,
        "OD Attendance": odAttendance,
        medical: medical,
        Medical: medical,
        percentage: percentageText,
        percentageClean: cleanPct,
        "Total %": percentageText,
        "Total%": percentageText,
        belowThreshold: !isNaN(cleanPct) && cleanPct < 75
      });
    });

    return {
      success: true,
      page: "AttendanceSubjectWise",
      sections: [{ headers: ['Subject', 'Present', 'Total', '%'], rows: subjects }],
      data: subjects,
      semesters: semesterOptions,
      semesterOptions: semesterOptions
    };

  } catch (err) {
    if (err.message === "SESSION_EXPIRED") throw err;
    return { success: false, page: "AttendanceSubjectWise", error: err.message, sections: [] };
  }
};


export const scrapeAttendance = async (adm, cookie, body) => {
  const details = await scrapeAttendanceDetails(adm, cookie, body);
  const subjectWise = await scrapeAttendanceSubjectWise(adm, cookie, body);
  return {
    success: true,
    page: "AttendanceCombined",
    details,
    subjectWise
  };
};

export const scrapeInternalMark = (adm, cookie, body) =>
  scrapeSemesterDropdownPage('InternalMark', SPECS.sectionEndpoints.InternalMark, cookie, body);

export const scrapeInternalToUniversity = (adm, cookie) =>
  scrapePage('InternalToUniversity', SPECS.sectionEndpoints.InternalToUniversity, cookie);

export const scrapeOnlineExam = (adm, cookie) =>
  scrapePage('OnlineExam', SPECS.sectionEndpoints.OnlineExam, cookie);

export const scrapeOnlineClass = (adm, cookie) =>
  scrapePage('OnlineClass', SPECS.sectionEndpoints.OnlineClass, cookie);

export const scrapeFYUGP = (adm, cookie) =>
  scrapePage('FYUGP', SPECS.sectionEndpoints.FYUGP, cookie);

export const scrapeExamResult = async (adm, cookie, body) => {
  const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
  const url = SPECS.sectionEndpoints.ExamResult;
  const requestHeaders = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Host": "eportal.maraugusthinosecollege.org",
    "Referer": PORTAL_BASE + "/Dashboard.aspx"
  };

  const getResponse = await fetch(PORTAL_BASE + url, { method: "GET", headers: requestHeaders, redirect: "manual" });
  if (getResponse.status === 302) throw new Error("SESSION_EXPIRED");
  const getHtml = await getResponse.text();
  if (getHtml.includes("btnLogin") || getHtml.includes("txtUser")) throw new Error("SESSION_EXPIRED");

  const $ = cheerio.load(getHtml);
  const finalPayload = helperExtractFormFields($);
  
  const semesterOptions = [];
  let semesterFieldName = "ctl00$MainContent$drop_exam"; // Changed default
  let portalDefaultSem = null;
  $("select").each((_, el) => {
    const name = $(el).attr("name") || "";
    if (name.toLowerCase().includes("sem") || name.toLowerCase().includes("exam")) semesterFieldName = name;
    $(el).find("option").each((_, opt) => {
      const value = $(opt).attr("value");
      const text = $(opt).text().trim();
      if (value && text) {
        semesterOptions.push({ value, text, selected: false });
        if ($(opt).prop("selected") || $(opt).attr("selected")) portalDefaultSem = value;
      }
    });
  });

  if (semesterOptions.length === 0) {
    return { page: "ExamResult", sections: [], semesters: [], semesterOptions: [] };
  }

  let targetSemester = body?.semester || null;
  if (!targetSemester) {
    let maxVal = -1;
    let maxSemVal = "";
    semesterOptions.forEach(opt => {
      const numericVal = parseInt(opt.value, 10);
      if (!isNaN(numericVal) && numericVal > maxVal) { maxVal = numericVal; maxSemVal = opt.value; }
    });
    targetSemester = maxSemVal || portalDefaultSem || semesterOptions[0]?.value || "2";
  }

  if (targetSemester && !semesterOptions.find(o => o.value == targetSemester)) {
    throw new Error("No exams available");
  }

  semesterOptions.forEach(opt => opt.selected = (opt.value === targetSemester));

  finalPayload[semesterFieldName] = targetSemester;
  finalPayload["__EVENTTARGET"] = semesterFieldName;
  finalPayload["__EVENTARGUMENT"] = "";
  delete finalPayload["ctl00$MainContent$btnSubmit"];
  delete finalPayload["ctl00$MainContent$btn_Cancel"];

  const bodyParams = new URLSearchParams();
  for (const [k, v] of Object.entries(finalPayload)) bodyParams.append(k, v);

  let postPath = url;
  const form = $("input[name='__VIEWSTATE']").closest("form");
  if (form.length && form.attr("action")) {
    const actionAttr = form.attr("action").trim();
    if (actionAttr && actionAttr !== "#") {
      if (actionAttr.startsWith("./")) postPath = "/" + actionAttr.substring(2);
      else if (actionAttr.startsWith("/")) postPath = actionAttr;
      else if (!actionAttr.startsWith("http")) {
        const lastSlash = url.lastIndexOf("/");
        postPath = (lastSlash >= 0 ? url.substring(0, lastSlash) : "") + "/" + actionAttr;
      }
    }
  }

  const postHeaders = { ...requestHeaders, "Content-Type": "application/x-www-form-urlencoded" };
  const postResponse = await fetch(PORTAL_BASE + postPath, { method: "POST", headers: postHeaders, body: bodyParams.toString() });
  
  let postHtml = await postResponse.text();
  if (postHtml.includes("btnLogin") || postHtml.includes("txtUser")) throw new Error("SESSION_EXPIRED");

  if (postHtml.includes('|updatePanel|')) {
    const parts = parseUpdatePanelDelta(postHtml);
    const htmlParts = parts.filter(p => p.type === 'updatePanel').map(p => p.content).join('');
    if (htmlParts) postHtml = `<html><body>${htmlParts}</body></html>`;
  }

  const parsed = parseHtml("ExamResult", postHtml);
  parsed.semesters = semesterOptions;
  parsed.semesterOptions = semesterOptions;
  parsed.debugHtml = postHtml.substring(0, 500);
  parsed.debugLength = postHtml.length;
  return parsed;
};

export const scrapeGraceMark = (adm, cookie) =>
  scrapePage('GraceMark', SPECS.sectionEndpoints.GraceMark, cookie);

export const scrapeHallTicket = (adm, cookie) =>
  scrapePage('HallTicket', SPECS.sectionEndpoints.HallTicket, cookie);

export const scrapeAllotmentMemo = (adm, cookie) =>
  scrapePage('AllotmentMemo', SPECS.sectionEndpoints.AllotmentMemo, cookie);

export const scrapeFeePayment = (adm, cookie) =>
  scrapePage('FeePayment', SPECS.sectionEndpoints.FeePay, cookie);

export const scrapeFeedback = (adm, cookie) =>
  scrapePage('FeedBack', SPECS.sectionEndpoints.FeedBack, cookie);

export const scrapeGrievance = (adm, cookie) =>
  scrapePage('Grievance', SPECS.sectionEndpoints.Grievance, cookie);

export const scrapeConcession = (adm, cookie) =>
  scrapePage('Concession', SPECS.sectionEndpoints.Concession, cookie);

/**
 * Route section name to scraper function.
 */
export const SCRAPERS = {
  profile: scrapeProfile,
  dashboard: scrapeDashboard,
  studyMaterial: scrapeStudyMaterial,
  assessment: scrapeAssessment,
  assignment: scrapeAssignment,
  seminar: scrapeSeminar,
  attendance: scrapeAttendance,
  attendanceDetails: scrapeAttendanceDetails,
  attendanceSubjectWise: scrapeAttendanceSubjectWise,
  subjectWiseAttendance: scrapeAttendanceSubjectWise,
  internalMark: scrapeInternalMark,
  internalUniversity: scrapeInternalToUniversity,
  onlineExam: scrapeOnlineExam,
  onlineClass: scrapeOnlineClass,
  fyugp: scrapeFYUGP,
  examResult: scrapeExamResult,
  graceMark: scrapeGraceMark,
  hallTicket: scrapeHallTicket,
  allotmentMemo: scrapeAllotmentMemo,
  feePayment: scrapeFeePayment,
  feedback: scrapeFeedback,
  grievance: scrapeGrievance,
  concession: scrapeConcession,
};
