const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const qs = require("qs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = "https://eportal.maraugusthinosecollege.org";

// In-memory session cache (no Redis)
const sessionCache = {};
const TTL = 20 * 60 * 1000; // 20 minutes in milliseconds

/**
 * Prefix logging helper.
 */
function log(prefix, message, ...args) {
  console.log(`[${prefix}] ${message}`, ...args);
}

/**
 * Creates a base axios client with default headers and timeout.
 * 
 * @param {string} cookie - Optional cookie string to include in headers
 * @returns {import('axios').AxiosInstance}
 */
function createPortalClient(cookie = "") {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 10000, // 10-second timeout safety
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": cookie
    },
    maxRedirects: 0 // Follow redirects: false to intercept cookies and 302s
  });
}

/**
 * Phase 1: Step 1 — Pre-flight GET /Login.aspx and token extraction.
 * 
 * @param {string} html - Login page HTML
 * @returns {Object} Extracted ASP.NET form tokens and input field names
 */
function getTokens(html) {
  const $ = cheerio.load(html);
  
  const tokens = {
    __VIEWSTATE: $("#__VIEWSTATE").val(),
    __VIEWSTATEGENERATOR: $("#__VIEWSTATEGENERATOR").val(),
    __EVENTVALIDATION: $("#__EVENTVALIDATION").val(),
    // Dynamically identify input field names
    uField: $('input[type="text"]').attr("name") || "txtusername",
    pField: $('input[type="password"]').attr("name") || "txtpassword",
    sField: $('input[type="submit"]').attr("name") || "btnLogin",
    sVal: $('input[type="submit"]').attr("value") || "Login"
  };

  const missing = [];
  if (!tokens.__VIEWSTATE) missing.push("__VIEWSTATE");
  if (!tokens.__VIEWSTATEGENERATOR) missing.push("__VIEWSTATEGENERATOR");
  if (!tokens.__EVENTVALIDATION) missing.push("__EVENTVALIDATION");

  if (missing.length > 0) {
    tokens.missing = missing;
  }

  return tokens;
}

/**
 * Phase 1: Step 2, 3, 4 — Authenticates and caches the session cookie.
 * 
 * @param {string} admissionNo - Student admission number
 * @returns {Promise<string>} Cached session cookie
 */
async function loginAndCache(admissionNo) {
  log("AUTH", `Starting handshake for: ${admissionNo}`);
  const client = createPortalClient();

  // Step 1: Pre-flight GET
  let preflightRes;
  try {
    preflightRes = await client.get("/Login.aspx");
  } catch (err) {
    log("ERROR", `Pre-flight GET failed: ${err.message}`);
    throw { status: 502, error: "PORTAL_UNREACHABLE", detail: err.message };
  }

  const tokens = getTokens(preflightRes.data);
  if (tokens.missing) {
    log("ERROR", `Tokens missing from pre-flight: ${tokens.missing.join(", ")}`);
    throw { status: 502, error: "PORTAL_SCRAPE_FAILED", missing: tokens.missing };
  }

  // Step 2: Login POST
  const loginPayload = {
    __VIEWSTATE: tokens.__VIEWSTATE,
    __VIEWSTATEGENERATOR: tokens.__VIEWSTATEGENERATOR,
    __EVENTVALIDATION: tokens.__EVENTVALIDATION,
    [tokens.uField]: admissionNo,
    [tokens.pField]: admissionNo, // password is same as username by default
    [tokens.sField]: tokens.sVal
  };

  let loginRes;
  try {
    loginRes = await client.post("/Login.aspx", qs.stringify(loginPayload), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      validateStatus: (status) => status === 200 || status === 302
    });
  } catch (err) {
    log("ERROR", `Login POST failed: ${err.message}`);
    throw { status: 502, error: "PORTAL_UNREACHABLE", detail: err.message };
  }

  // Step 3: Session Capture & Changed Password Check
  const bodyText = loginRes.data || "";
  const isInvalidCreds = /invalid credentials|invalid username|password incorrect/i.test(bodyText);
  if (isInvalidCreds) {
    log("AUTH", `Invalid credentials response detected for: ${admissionNo}`);
    throw { status: 403, error: "MANUAL_PASSWORD_REQUIRED" };
  }

  const cookies = loginRes.headers["set-cookie"];
  if (!cookies || cookies.length === 0) {
    log("AUTH", `No cookies received for: ${admissionNo}`);
    throw { status: 403, error: "MANUAL_PASSWORD_REQUIRED" };
  }

  // Target: ASP.NET_SessionId
  const sessionCookie = cookies.find(c => c.startsWith("ASP.NET_SessionId")) || cookies[0];
  const cleanedCookie = sessionCookie.split(";")[0];

  log("AUTH", `Authentication successful. Session captured: ${cleanedCookie}`);

  // Step 4: Session Cache
  sessionCache[admissionNo] = {
    cookie: cleanedCookie,
    timestamp: Date.now()
  };
  log("CACHE", `Cached session for ${admissionNo}`);

  return cleanedCookie;
}

/**
 * Shared wrapper client that handles silent re-authentication via interceptors.
 * 
 * @param {string} admissionNo 
 * @param {string} initialCookie 
 * @returns {import('axios').AxiosInstance}
 */
function getSharedSessionClient(admissionNo, initialCookie) {
  const client = createPortalClient(initialCookie);

  client.interceptors.response.use(
    async (response) => {
      const body = response.data || "";
      const isLoginForm = typeof body === "string" && (body.includes("Login.aspx") || body.includes('id="LoginForm"'));
      
      if (isLoginForm || response.status === 302) {
        log("AUTH", `Expired session detected (login form redirect). Silently re-authenticating ${admissionNo}...`);
        try {
          const freshCookie = await loginAndCache(admissionNo);
          response.config.headers["Cookie"] = freshCookie;
          // Retry the request ONCE with new cookie
          return axios(response.config);
        } catch (err) {
          log("ERROR", `Silent re-authentication failed: ${err.message}`);
          return Promise.reject(err);
        }
      }
      return response;
    },
    async (error) => {
      const { response, config } = error;
      if (response && (response.status === 302 || response.status === 401)) {
        log("AUTH", `Expired session detected (HTTP ${response.status}). Silently re-authenticating ${admissionNo}...`);
        try {
          const freshCookie = await loginAndCache(admissionNo);
          config.headers["Cookie"] = freshCookie;
          // Retry request ONCE
          return axios(config);
        } catch (err) {
          log("ERROR", `Silent re-authentication failed: ${err.message}`);
          return Promise.reject(err);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Phase 2: A. Scrapes and parses Dashboard.aspx.
 * 
 * @param {import('axios').AxiosInstance} client 
 * @returns {Promise<Object>}
 */
async function fetchDashboard(client) {
  log("FETCH", "Fetching Dashboard.aspx...");
  const res = await client.get("/Dashboard.aspx");
  
  // Try to parse as JSON first (as per spec)
  try {
    return JSON.parse(res.data);
  } catch {
    // Fall back to cheerio parsing
  }

  const $ = cheerio.load(res.data);
  const data = {
    name: null,
    semester: "Sem 2", // Default/fallback semester
    studyMaterial: null,
    assessments: null,
    assignments: null,
    seminars: null
  };

  // Name extraction (looks for student name in capitalized text lines)
  $("*").each((_, el) => {
    if ($(el).children().length === 0) {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 40 && text === text.toUpperCase() && /^[A-Z\s]+$/.test(text)) {
        if (!["DASHBOARD", "EDULOOM", "EXAM", "MACHUB"].some(w => text.includes(w))) {
          data.name = text;
          return false; // Break loop
        }
      }
    }
  });

  // Numeric card counters extraction
  const cardLabels = {
    "study material": "studyMaterial",
    "assessment": "assessments",
    "assignment": "assignments",
    "seminar": "seminars"
  };

  const lines = [];
  $("*").each((_, el) => {
    if ($(el).children().length === 0) {
      const t = $(el).text().trim();
      if (t) lines.push(t);
    }
  });

  lines.forEach((line, i) => {
    const lowerLine = line.toLowerCase();
    for (const [label, key] of Object.entries(cardLabels)) {
      if (lowerLine === label) {
        // Search adjacent text lines for numbers
        for (let offset = -3; offset <= 3; offset++) {
          const idx = i + offset;
          if (idx >= 0 && idx < lines.length) {
            if (/^\d+$/.test(lines[idx])) {
              data[key] = parseInt(lines[idx], 10);
              break;
            }
          }
        }
      }
    }
  });

  return data;
}

/**
 * Phase 2: B. Scrapes and parses StudyMaterial.aspx subjects list.
 * 
 * @param {import('axios').AxiosInstance} client 
 * @returns {Promise<Array>}
 */
async function fetchSubjects(client) {
  log("FETCH", "Fetching StudyMaterial.aspx...");
  const res = await client.get("/StudyMaterial.aspx");

  try {
    return JSON.parse(res.data);
  } catch {}

  const $ = cheerio.load(res.data);
  const subjects = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 2) return;

    const headers = [];
    $(rows[0]).find("th, td").each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    const hasSubject = headers.some(h => h.includes("subject") || h.includes("course"));
    if (!hasSubject) return;

    rows.slice(1).each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length === 0) return;

      const record = { name: "", code: "", semester: "Sem 2", category: "Core Course" };

      cells.each((i, cell) => {
        const header = headers[i] || "";
        const val = $(cell).text().trim();

        if (header.includes("subject") || header.includes("name")) {
          const match = val.match(/^(.+?)\s*\(([^)]+)\)$/);
          if (match) {
            record.name = match[1].trim();
            record.code = match[2].trim();
          } else {
            record.name = val;
          }
        } else if (header.includes("code")) {
          record.code = val;
        } else if (header.includes("semester")) {
          record.semester = val;
        } else if (header.includes("category") || header.includes("type")) {
          record.category = val;
        }
      });

      if (record.name) {
        subjects.push(record);
      }
    });
  });

  return subjects;
}

/**
 * Phase 2: C. Scrapes and parses StdAssessmentNew.aspx assessments/internal marks.
 * 
 * @param {import('axios').AxiosInstance} client 
 * @returns {Promise<Array>}
 */
async function fetchAssessments(client) {
  log("FETCH", "Fetching StdAssessmentNew.aspx...");
  const res = await client.get("/StdAssessmentNew.aspx");

  try {
    return JSON.parse(res.data);
  } catch {}

  const $ = cheerio.load(res.data);
  const assessments = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 2) return;

    // Headings above tables
    let subjectName = "";
    let sibling = $(table).prev();
    while (sibling.length > 0) {
      const hText = sibling.text().trim();
      if (hText && hText.length > 4 && !/^\d+$/.test(hText)) {
        subjectName = hText.replace(/\s*\([^)]+\)/g, "").trim();
        break;
      }
      sibling = sibling.prev();
    }

    if (!subjectName) subjectName = "Unknown Subject";

    const headers = [];
    $(rows[0]).find("th, td").each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    rows.slice(1).each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length === 0) return;

      const record = {
        subject: subjectName,
        type: "",
        score: null,
        maxMark: null,
        passMark: null,
        status: null
      };

      cells.each((i, cell) => {
        const header = headers[i] || "";
        const val = $(cell).text().trim();

        if (header.includes("type") || header.includes("assessment") || header.includes("exam")) {
          record.type = val;
        } else if (header.includes("score") || header.includes("mark") || header.includes("obtained")) {
          record.score = val ? parseFloat(val) : null;
        } else if (header.includes("max") || header.includes("total")) {
          record.maxMark = val ? parseFloat(val) : null;
        } else if (header.includes("pass")) {
          record.passMark = val ? parseFloat(val) : null;
        } else if (header.includes("status") || header.includes("result")) {
          record.status = val || null;
        }
      });

      // Default fallback
      if (!record.type && cells.length >= 5) {
        record.type = $(cells[0]).text().trim();
        record.score = parseFloat($(cells[1]).text().trim()) || null;
        record.maxMark = parseFloat($(cells[2]).text().trim()) || null;
        record.passMark = parseFloat($(cells[3]).text().trim()) || null;
        record.status = $(cells[4]).text().trim() || null;
      }

      if (record.type || record.score !== null) {
        assessments.push(record);
      }
    });
  });

  return assessments;
}

/**
 * Phase 2: Master JSON Output builder.
 * 
 * @param {string} admissionNo - Student admission number
 * @param {Object} dashboard - Dashboard data slice
 * @param {Array} subjects - Subjects list
 * @param {Array} assessments - Assessments list
 * @param {Array} errors - Logged errors during concurrent fetch
 * @returns {Object} Strictly typed Master JSON object
 */
function buildMasterJSON(admissionNo, dashboard, subjects, assessments, errors) {
  return {
    admissionNo: admissionNo,
    syncedAt: new Date().toISOString(),
    profile: {
      name: dashboard?.name || null,
      semester: dashboard?.semester || null
    },
    dashboard: {
      studyMaterial: dashboard?.studyMaterial !== undefined ? dashboard.studyMaterial : null,
      assessments: dashboard?.assessments !== undefined ? dashboard.assessments : null,
      assignments: dashboard?.assignments !== undefined ? dashboard.assignments : null,
      seminars: dashboard?.seminars !== undefined ? dashboard.seminars : null
    },
    subjects: subjects || [],
    assessments: assessments || [],
    assignments: [], // Always empty array per spec
    seminars: [],    // Always empty array per spec
    hallTicket: null, // Always null if not available per spec
    errors: errors.length > 0 ? errors : undefined
  };
}

// ── SYNC CONTROLLER ─────────────────────────────────────────────────────────
app.post("/api/sync", async (req, res) => {
  const { admissionNo } = req.body;
  if (!admissionNo) {
    return res.status(400).json({ error: "admissionNo is required" });
  }

  let cookie = "";
  const cached = sessionCache[admissionNo];

  // TTL: 20 minutes check
  if (cached && (Date.now() - cached.timestamp < TTL)) {
    log("CACHE", `Using cached session for student: ${admissionNo}`);
    cookie = cached.cookie;
  } else {
    // Perform fresh login handshake
    try {
      cookie = await loginAndCache(admissionNo);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json(err);
      }
      return res.status(500).json({ error: "UNKNOWN_LOGIN_ERROR", detail: err.message });
    }
  }

  const client = getSharedSessionClient(admissionNo, cookie);
  const errors = [];

  // Phase 2: Concurrent Data Fetch with Promise.allSettled()
  const fetchPromises = [
    fetchDashboard(client).catch(err => {
      const reason = err.code === "ECONNABORTED" ? "TIMEOUT" : "PARSE_FAILED";
      errors.push({ endpoint: "Dashboard", reason, detail: err.message });
      return null;
    }),
    fetchSubjects(client).catch(err => {
      const reason = err.code === "ECONNABORTED" ? "TIMEOUT" : "PARSE_FAILED";
      errors.push({ endpoint: "StudyMaterial", reason, detail: err.message });
      return null;
    }),
    fetchAssessments(client).catch(err => {
      const reason = err.code === "ECONNABORTED" ? "TIMEOUT" : "PARSE_FAILED";
      errors.push({ endpoint: "StdAssessmentNew", reason, detail: err.message });
      return null;
    })
  ];

  const results = await Promise.allSettled(fetchPromises);

  const dashVal = results[0].status === "fulfilled" ? results[0].value : null;
  const subjVal = results[1].status === "fulfilled" ? results[1].value : [];
  const assVal = results[2].status === "fulfilled" ? results[2].value : [];

  const masterJSON = buildMasterJSON(
    admissionNo,
    dashVal,
    subjVal,
    assVal,
    errors
  );

  res.json(masterJSON);
});

// Start Server
app.listen(PORT, () => {
  log("AUTH", `Option B Backend Bridge listening on port ${PORT}`);
});
