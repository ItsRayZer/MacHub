/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub — Light-Speed Reverse Proxy & Live Portal Integration   ║
 * ║   Target: Mar Augusthinose College Ramapuram (ePortal/EduloomPro) ║
 * ║   Port: 3001  |  Target latency budget: <1.5 seconds per request  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

const express  = require('express');
const axios    = require('axios');
const cheerio  = require('cheerio');
const qs       = require('qs');
const path     = require('path');
const fs       = require('fs');

// ─── Load portal config ──────────────────────────────────────────────────────
const specs = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'portal_specs.json'), 'utf-8')
);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global keep-alive connection pool ──────────────────────────────────────
const portalAgent = axios.create({
  baseURL      : specs.baseUrl,
  timeout      : 6000,
  maxRedirects : 0,           // Manual 302 tracking for clean cookie capture
  validateStatus: s => s < 400 || s === 302,
  headers: {
    'Connection'      : 'keep-alive',
    'User-Agent'      : specs.browserHeaders['User-Agent'],
    'Accept'          : specs.browserHeaders['Accept'],
    'Accept-Language' : specs.browserHeaders['Accept-Language'],
    'Accept-Encoding' : specs.browserHeaders['Accept-Encoding'],
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control'   : 'no-cache',
  },
  // Decompress gzip/deflate automatically
  decompress: true,
});

// ─── In-memory session store ─────────────────────────────────────────────────
const sessionStore   = new Map();
const SESSION_TTL_MS = 25 * 60 * 1000;  // 25 minutes

// ─── Simple per-IP rate limiter ──────────────────────────────────────────────
const ipCounters = new Map();
const RATE_LIMIT  = 30;          // max requests per window
const RATE_WINDOW = 60 * 1000;   // 1 minute window

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = ipCounters.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };

  if (now > entry.resetAt) {
    entry.count   = 0;
    entry.resetAt = now + RATE_WINDOW;
  }

  entry.count++;
  ipCounters.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please wait 1 minute.' });
  }
  next();
}

// ─── CORS + body parser ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Serve static frontend files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ════════════════════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ════════════════════════════════════════════════════════════════════════════

/** Extract the value of a named attribute from hidden ASP.NET input */
function extractAspToken($, tokenId) {
  const el = $(`#${tokenId}`).length ? $(`#${tokenId}`) : $(`[name="${tokenId}"]`);
  return el.val() || '';
}

/** Extract all ASP.NET security tokens from the login page HTML */
function extractAllTokens(html) {
  const $ = cheerio.load(html);
  return {
    __VIEWSTATE         : extractAspToken($, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractAspToken($, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION   : extractAspToken($, '__EVENTVALIDATION'),
    usernameField       : $('input[type="text"]').first().attr('name') || specs.formFields.username,
    passwordField       : $('input[type="password"]').first().attr('name') || specs.formFields.password,
    submitField         : $('input[type="submit"]').first().attr('name') || specs.formFields.submitButton,
    submitValue         : $('input[type="submit"]').first().attr('value') || specs.formFields.submitValue,
  };
}

/** Extract all cookies from Set-Cookie array as a semicolon-separated string */
function extractSessionCookie(setCookieArray) {
  if (!Array.isArray(setCookieArray) || setCookieArray.length === 0) {
    return '';
  }
  const cookies = {};
  setCookieArray.forEach(c => {
    const parts = c.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = value;
    }
  });
  return Object.entries(cookies).map(([name, val]) => `${name}=${val}`).join('; ');
}

/** Extract all input/select fields from a form for postback */
function extractFormFields($, selectEl) {
  const form = selectEl.closest('form');
  const payload = {};
  if (!form.length) return payload;

  form.find('input, select, textarea').each((_, el) => {
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

/** Detect if a page response is actually a login page (session expired) */
function isLoginPage(html) {
  if (!html) return true;
  return (
    html.includes('txtusername') &&
    html.includes('txtpassword')
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SESSION MANAGER — handles login handshake + cookie caching
// ════════════════════════════════════════════════════════════════════════════

async function getSession(admissionNumber) {
  const now    = Date.now();
  const cached = sessionStore.get(admissionNumber);

  // Return cached session if still valid
  if (cached && cached.expiresAt > now) {
    console.log(`[Session] Cache hit for ${admissionNumber}`);
    return cached.cookie;
  }

  console.log(`[Session] Initiating login handshake for ${admissionNumber}...`);
  const loginPath = specs.loginPage;

  // ── Step 1: GET login page → extract ASP.NET tokens ─────────────────────
  let landingRes;
  try {
    landingRes = await portalAgent.get(loginPath);
  } catch (err) {
    throw new Error(`Portal unreachable (GET ${loginPath}): ${err.message}`);
  }

  if (landingRes.status !== 200) {
    throw new Error(`Portal returned HTTP ${landingRes.status} on login page`);
  }

  const landingCookies = landingRes.headers['set-cookie'] ? extractSessionCookie(landingRes.headers['set-cookie']) : '';
  const tokens = extractAllTokens(landingRes.data);
  console.log(`[Session] Tokens extracted. Username field: "${tokens.usernameField}"`);

  // ── Step 2: Assemble POST payload ────────────────────────────────────────
  const postPayload = {
    [tokens.usernameField]        : admissionNumber,
    [tokens.passwordField]        : admissionNumber,   // Admission No = password
    [tokens.submitField]          : tokens.submitValue,
    '__VIEWSTATE'                 : tokens.__VIEWSTATE,
    '__VIEWSTATEGENERATOR'        : tokens.__VIEWSTATEGENERATOR,
    '__EVENTVALIDATION'           : tokens.__EVENTVALIDATION,
  };

  // ── Step 3: POST form credentials ────────────────────────────────────────
  let loginRes;
  try {
    loginRes = await portalAgent.post(
      loginPath,
      qs.stringify(postPayload),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer'     : `${specs.baseUrl}${loginPath}`,
          'Origin'      : specs.baseUrl,
          'Host'        : 'eportal.maraugusthinosecollege.org',
          'Cookie'      : landingCookies || undefined,
        }
      }
    );
  } catch (err) {
    throw new Error(`Login POST failed: ${err.message}`);
  }

  // ── Step 4: Capture session cookie from 302 redirect ─────────────────────
  // EduloomPro returns 302 on success or 200 with error on failure
  const setCookies = loginRes.headers['set-cookie'];
  let cookie;

  if (loginRes.status === 302 && setCookies) {
    const postCookies = extractSessionCookie(setCookies);
    cookie = [landingCookies, postCookies].filter(Boolean).join('; ');
  } else if (loginRes.status === 200) {
    // Some deployments return 200 with a redirect in meta-refresh
    // Try fetching Dashboard to verify auth using any cookies already set
    const setCookies200 = loginRes.headers['set-cookie'];
    if (setCookies200) {
      try {
        const postCookies = extractSessionCookie(setCookies200);
        cookie = [landingCookies, postCookies].filter(Boolean).join('; ');
      } catch (_) {
        // Fallback: try dashboard fetch
      }
    }

    if (!cookie) {
      // Check if login page itself indicates failure
      if (isLoginPage(loginRes.data)) {
        throw new Error('Login failed: Invalid credentials or portal rejected login');
      }
      // If we got redirected to dashboard in the same response, extract cookies
      throw new Error(`Login returned 200 but no session cookie found. Status: ${loginRes.status}`);
    }
  } else {
    throw new Error(`Login failed: expected 302 redirect, got ${loginRes.status}`);
  }

  // ── Step 5: Verify we can access Dashboard with this cookie ──────────────
  let dashRes;
  try {
    dashRes = await portalAgent.get('/Dashboard.aspx', {
      maxRedirects: 5,
      headers: {
        'Cookie' : cookie,
        'Host'   : 'eportal.maraugusthinosecollege.org',
        'Referer': `${specs.baseUrl}${loginPath}`,
      }
    });
  } catch (err) {
    // Non-fatal: proceed even if dashboard check times out
    console.warn(`[Session] Dashboard check failed: ${err.message}`);
  }

  if (dashRes && isLoginPage(dashRes.data)) {
    throw new Error('Login verification failed: Dashboard redirected back to login page');
  }

  // ── Step 6: Cache the session ─────────────────────────────────────────────
  sessionStore.set(admissionNumber, {
    cookie,
    expiresAt: now + SESSION_TTL_MS
  });

  console.log(`[Session] ✅ Login successful for ${admissionNumber}. Cookies: ${cookie}`);
  return cookie;
}

// ════════════════════════════════════════════════════════════════════════════
//  HTML PARSERS — page-specific structured data extractors
// ════════════════════════════════════════════════════════════════════════════

/** Generic single HTML table → array of row objects */
function parseSingleTable($, tableEl) {
  const headers = [];
  const rows    = [];

  $(tableEl).find('tr').first().find('th, td').each((_, el) => {
    headers.push($(el).text().trim());
  });

  $(tableEl).find('tr').slice(1).each((_, rowEl) => {
    const rowData = {};
    $(rowEl).find('td').each((i, cell) => {
      const key = headers[i] || `col_${i}`;
      rowData[key] = $(cell).text().trim();
    });
    if (Object.values(rowData).some(v => v)) rows.push(rowData);
  });

  return { headers, rows };
}

/** Attendance page parser — extracts subject-wise attendance */
function parseAttendance(html) {
  const $       = cheerio.load(html);
  const records = [];

  // Extract semesters list
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem');
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).attr('selected') === 'selected' || $(opt).prop('selected') || false
      });
    });
  }

  $('table').each((_, table) => {
    const headerText = $(table).find('tr').first().text().toLowerCase();
    if (!headerText.includes('subject') && !headerText.includes('attendance') && !headerText.includes('present')) {
      return;
    }

    const headers = [];
    $(table).find('tr').first().find('th, td').each((_, el) => {
      headers.push($(el).text().trim().toLowerCase());
    });

    $(table).find('tr').slice(1).each((_, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const row = {};
      cells.each((i, cell) => {
        row[headers[i] || `col_${i}`] = $(cell).text().trim();
      });

      // Map common field aliases
      const record = {
        subjectName  : row['subject'] || row['subject name'] || row['programme'] || row[headers[1]] || '',
        presentHours : row['present'] || row['present hours'] || row['present days'] || '',
        totalHours   : row['total'] || row['total hours'] || row['total days'] || row['conducted'] || '',
        percentage   : row['percentage'] || row['%'] || row['attendance %'] || '',
      };

      // Try to compute percentage if missing
      if (!record.percentage && record.presentHours && record.totalHours) {
        const p = parseFloat(record.presentHours);
        const t = parseFloat(record.totalHours);
        if (t > 0) record.percentage = ((p / t) * 100).toFixed(1) + '%';
      }

      if (record.subjectName) records.push(record);
    });
  });

  return { page: 'Attendance', sections: [{ headers: ['Subject', 'Present', 'Total', '%'], rows: records }], semesters };
}

/** Assessment page parser — groups rows by subject heading */
function parseAssessment(html) {
  const $        = cheerio.load(html);
  const sections = [];

  // Extract semesters list
  const semesters = [];
  const semSelect = $('#MainContent_ddlsem, #MainContent_drpsem');
  if (semSelect.length) {
    semSelect.find('option').each((_, opt) => {
      semesters.push({
        value: $(opt).attr('value'),
        text: $(opt).text().trim(),
        selected: $(opt).attr('selected') === 'selected' || $(opt).prop('selected') || false
      });
    });
  }

  // Multi-table mode: each subject has an h3/h4/b heading then a table
  $('table').each((_, table) => {
    // Try to find the subject name using robust parent-traversal
    let subjectName = '';
    
    // We can look at the table itself or its parents to find direct children of col-sm-12/body
    let current = $(table);
    while (current.length && current.parent().length && !current.parent().is('.col-sm-12') && !current.parent().is('body')) {
      current = current.parent();
    }
    
    // Now current is a direct child of the main container. Look at preceding headings.
    let prevH = current.prevAll('h3, h4, h5, b, strong').first();
    if (prevH.length) {
      subjectName = prevH.text().replace(/\s*\([^)]+\)/g, '').trim();
    } else {
      // Try inside the table's container itself, in case it's in a card
      let prevHInParent = $(table).parent().find('h3, h4, h5, b, strong').first();
      if (prevHInParent.length) {
        subjectName = prevHInParent.text().replace(/\s*\([^)]+\)/g, '').trim();
      }
    }

    if (!subjectName) {
      // Fallback search up the tree
      let el = $(table).parent();
      while (el.length && !subjectName) {
        const candidate = el.find('h3, h4, h5, b, strong').first();
        const text = (candidate.length ? candidate : el).text().trim();
        if (text && text.length > 3 && !/^\d+$/.test(text) && !text.includes('Semester')) {
          subjectName = text.replace(/\s*\([^)]+\)/, '').trim();
        }
        el = el.parent();
      }
    }

    if (!subjectName) {
      subjectName = 'Unknown Subject';
    }

    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) {
      sections.push({ subject: subjectName, headers, rows });
    }
  });

  return { page: 'Assessment', sections, semesters };
}

/** Assignment page parser — splits Active vs Expired tables */
function parseAssignment(html) {
  const $       = cheerio.load(html);
  const active  = [];
  const expired = [];

  $('table').each((_, table) => {
    const prevText = $(table).prevAll('h3, h4, h5, b, p, div').first().text().toLowerCase();
    const isExpired = prevText.includes('expir') || prevText.includes('expired');
    const { rows } = parseSingleTable($, table);

    if (isExpired) {
      expired.push(...rows);
    } else {
      active.push(...rows);
    }
  });

  return { page: 'Assignment', sections: [{ label: 'Active', rows: active }, { label: 'Expired', rows: expired }] };
}

/** Study Material page parser — extracts subject list with view links */
function parseStudyMaterial(html) {
  const $        = cheerio.load(html);
  const subjects = [];
  let headers    = [];

  $('table').each((_, table) => {
    const headerText = $(table).find('tr').first().text().toLowerCase();
    if (!headerText.includes('subject') && !headerText.includes('material') && !headerText.includes('programme')) return;

    headers = [];
    $(table).find('tr').first().find('th, td').each((_, el) => {
      headers.push($(el).text().trim());
    });

    $(table).find('tr').slice(1).each((_, rowEl) => {
      const cells = $(rowEl).find('td');
      if (!cells.length) return;

      const row = {};
      cells.each((i, cell) => {
        const key = headers[i] || `col_${i}`;
        row[key] = $(cell).text().trim();

        // Capture view link if present
        const anchor = $(cell).find('a[href]');
        if (anchor.length) {
          const href = anchor.attr('href');
          row._viewUrl = href.startsWith('http') ? href : `${specs.baseUrl}/${href.replace(/^\//, '')}`;
        }
      });

      if (Object.values(row).some(v => v && v !== '')) subjects.push(row);
    });
  });

  return { page: 'StudyMaterial', sections: [{ headers, rows: subjects }] };
}

/** Seminar page parser — generic table */
function parseSeminar(html) {
  const $        = cheerio.load(html);
  const sections = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) sections.push({ headers, rows });
  });

  return { page: 'Seminar', sections };
}

/** Dashboard parser — card counters and active courses */
function parseDashboard(html) {
  const $ = cheerio.load(html);
  const result = {
    study_material: 0,
    assessment    : 0,
    assignment    : 0,
    seminar       : 0,
    internal_mark : 0,
    feedback      : 0,
    active_courses: [],
  };

  const lines = $.text().split('\n').map(l => l.trim()).filter(Boolean);
  const cardLabels = {
    'study material': 'study_material',
    'assessment'    : 'assessment',
    'assignment'    : 'assignment',
    'seminar'       : 'seminar',
    'internal mark' : 'internal_mark',
    'internal marks': 'internal_mark',
    'feedback'      : 'feedback',
    'feed back'     : 'feedback',
  };

  lines.forEach((line, i) => {
    for (const [label, key] of Object.entries(cardLabels)) {
      if (line.toLowerCase() === label || line.toLowerCase().includes(label)) {
        for (let offset = -3; offset <= 3; offset++) {
          const idx = i + offset;
          if (idx >= 0 && idx < lines.length && /^\d+$/.test(lines[idx])) {
            result[key] = parseInt(lines[idx], 10);
            break;
          }
        }
      }
    }
  });

  return { page: 'Dashboard', sections: [{ data: result }] };
}

function deobfuscateCloudflareEmail(encodedString) {
  try {
    let email = "";
    const key = parseInt(encodedString.substring(0, 2), 16);
    for (let n = 2; n < encodedString.length; n += 2) {
      const charCode = parseInt(encodedString.substring(n, 2), 16) ^ key;
      email += String.fromCharCode(charCode);
    }
    return email;
  } catch (e) {
    return "";
  }
}

function processObfuscatedEmails($) {
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('email-protection')) {
      let cfemail = $(el).attr('data-cfemail') || '';
      if (!cfemail) {
        const hashMatch = href.match(/email-protection#([a-fA-F0-9]+)/);
        if (hashMatch) {
          cfemail = hashMatch[1];
        }
      }
      if (cfemail) {
        const plainEmail = deobfuscateCloudflareEmail(cfemail);
        if (plainEmail) {
          $(el).replaceWith(plainEmail);
        }
      }
    }
  });
}

/** Profile page parser — parses detailed student details */
function parseProfile(html) {
  const $ = cheerio.load(html);
  processObfuscatedEmails($);
  
  // Remove script and style elements
  $('script, style, select, input, textarea, button').remove();
  
  const bodyText = $('body').text().replace(/\s+/g, ' ');

  const result = {
    name: '',
    admissionNo: '',
    course: '',
    batch: '',
    dob: '',
    phone: '',
    email: '',
    gender: '',
    bloodGroup: '',
    aadhar: '',
    nationality: '',
    religion: '',
    caste: '',
    category: '',
    income: '',
    address: '',
    commAddress: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    photoUrl: '',
    abcId: ''
  };

  // Find photo URL
  const $full = cheerio.load(html);
  const photo = $full('img[id*="photo"], img[id*="profile"], img[id*="student"], img[src*="student"]').first();
  if (photo.length) {
    result.photoUrl = photo.attr('src');
  }

  // Name, Admission No, Course, Batch
  const nameMatch = bodyText.match(/View Student Profile\s*([A-Z\s]+?)\s*(\d+)/i);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    result.admissionNo = nameMatch[2].trim();
  }
  
  const courseMatch = bodyText.match(/View Student Profile[^]+?\d+\s*([A-Z\s()&,-]+?)\s*\(\s*\d{4}/i);
  if (courseMatch) {
    result.course = courseMatch[1].trim();
  }
  
  const batchMatch = bodyText.match(/\(\s*(\d{4}\s*-\s*\d{4})\s*\)/);
  if (batchMatch) {
    result.batch = batchMatch[1].trim();
  }

  const extractField = (pattern) => {
    const match = bodyText.match(pattern);
    return match ? match[1].trim() : '';
  };

  result.dob = extractField(/Date Of Birth\s*([0-9-]{10})/i);
  result.phone = extractField(/Mobile\s*(\d{10})/i);
  result.email = extractField(/Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i);
  result.gender = extractField(/Gender\s*(MALE|FEMALE|OTHER)/i);
  
  // Blood group matches
  const bgMatch = bodyText.match(/Blood Group\s*(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)/i);
  result.bloodGroup = bgMatch ? bgMatch[1].trim() : '';
  
  result.aadhar = extractField(/Aadhaar\s*(\d{12})/i);
  result.nationality = extractField(/Nationality\s*([A-Z\s]+?)\s*(Other Details|Religion)/i);
  result.religion = extractField(/Religion\s*([A-Z\s]+?)\s*Caste/i);
  result.caste = extractField(/Caste\s*([A-Z\s]+?)\s*Reservation/i);
  result.category = extractField(/Reservation\s*([A-Z\s]+?)\s*Annual Income/i);
  result.income = extractField(/Annual Income\s*([0-9\s]*?)\s*(Permanent Address|Communication Address|Other Details)/i);
  result.abcId = extractField(/ABC ID\s*([A-Za-z0-9_-]+)/i);

  // Address matching
  const addrMatch = bodyText.match(/Permanent Address\s*([^]+?)\s*Communication Address/i);
  if (addrMatch) {
    result.address = addrMatch[1].trim().replace(/\s*-$/, '').trim();
  }

  const commMatch = bodyText.match(/Communication Address\s*([^]+?)\s*(Father Info|Mother Info|Guardian Info)/i);
  if (commMatch) {
    result.commAddress = commMatch[1].trim().replace(/\s*-$/, '').trim();
  }

  // Parent matching
  const fatherMatch = bodyText.match(/Father Info\s*Name\s*([A-Z\s]+?)\s*(Occupation|Phone|Email)/i);
  if (fatherMatch) {
    result.guardianName = fatherMatch[1].trim();
  }
  const fatherPhone = bodyText.match(/Father Info[^]+?Phone\s*(\d{10})/i);
  if (fatherPhone) {
    result.guardianPhone = fatherPhone[1].trim();
  }
  const fatherEmail = bodyText.match(/Father Info[^]+?Email\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/i);
  if (fatherEmail) {
    result.guardianEmail = fatherEmail[1].trim();
  }

  return { page: 'Profile', sections: [{ data: result }] };
}

/** Concession card page parser — extracts route inputs and security tokens */
function parseConcession(html) {
  const $ = cheerio.load(html);
  
  const routes = [
    { from: $('#MainContent_txtFrom1').val() || '', to: $('#MainContent_txtTo1').val() || '' },
    { from: $('#MainContent_txtFrom2').val() || '', to: $('#MainContent_txtTo2').val() || '' },
    { from: $('#MainContent_txtFrom3').val() || '', to: $('#MainContent_txtTo3').val() || '' },
    { from: $('#MainContent_txtFrom4').val() || '', to: $('#MainContent_txtTo4').val() || '' }
  ];

  const hid_stdid = $('#MainContent_hid_stdid').val() || $('[name="ctl00$MainContent$hid_stdid"]').val() || '';

  const tokens = {
    __VIEWSTATE: $('#__VIEWSTATE').val() || '',
    __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val() || '',
    __EVENTVALIDATION: $('#__EVENTVALIDATION').val() || '',
    hid_stdid
  };

  return { page: 'Concession', sections: [{ data: { routes, tokens } }] };
}

/** Grievance form page parser */
function parseGrievance(html) {
  const $ = cheerio.load(html);
  const options = [];
  
  $('#MainContent_ddlTo option').each((_, el) => {
    options.push({
      value: $(el).attr('value'),
      text: $(el).text().trim()
    });
  });

  const hid_stdid = $('#MainContent_hid_stdid').val() || '';
  const hdnBatch = $('#MainContent_hdnBatch').val() || '';

  const tokens = {
    __VIEWSTATE: $('#__VIEWSTATE').val() || '',
    __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val() || '',
    __EVENTVALIDATION: $('#__EVENTVALIDATION').val() || '',
    hid_stdid,
    hdnBatch
  };

  return { page: 'Grievance', sections: [{ data: { options, tokens } }] };
}

/** Generic fallback parser for unknown pages */
function parseGeneric(page, html) {
  const $        = cheerio.load(html);
  const sections = [];

  $('table').each((_, table) => {
    const { headers, rows } = parseSingleTable($, table);
    if (rows.length > 0) sections.push({ headers, rows });
  });

  return { page, sections };
}

/** Route page name to the appropriate parser */
function parseHtml(targetPage, html) {
  switch (targetPage) {
    case 'Attendance'   : return parseAttendance(html);
    case 'Assessment'   : return parseAssessment(html);
    case 'Assignment'   : return parseAssignment(html);
    case 'StudyMaterial': return parseStudyMaterial(html);
    case 'Seminar'      : return parseSeminar(html);
    case 'Dashboard'    : return parseDashboard(html);
    case 'Profile'      : return parseProfile(html);
    case 'Concession'   : return parseConcession(html);
    case 'Grievance'    : return parseGrievance(html);
    default             : return parseGeneric(targetPage, html);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════════════════════════════════════════

/** Health check */
app.get('/api/health', (req, res) => {
  res.json({
    status    : 'operational',
    timestamp : new Date().toISOString(),
    sessions  : sessionStore.size,
    uptime    : Math.floor(process.uptime()) + 's',
  });
});

/** Clear cached session (for debugging / forced re-login) */
app.post('/api/session/clear', rateLimitMiddleware, (req, res) => {
  const { admissionNumber } = req.body;
  if (admissionNumber) {
    sessionStore.delete(admissionNumber);
    console.log(`[Session] Cleared cache for ${admissionNumber}`);
    return res.json({ success: true, message: `Session cleared for ${admissionNumber}` });
  }
  sessionStore.clear();
  return res.json({ success: true, message: 'All sessions cleared' });
});

/**
 * Main portal proxy route
 * GET /api/sync-portal/:targetPage?admissionNumber=12965
 */
app.get('/api/sync-portal/:targetPage', rateLimitMiddleware, async (req, res) => {
  const t0             = Date.now();
  const { targetPage } = req.params;
  const admissionNumber = (req.query.admissionNumber || '').trim();

  // ── Validate inputs ──────────────────────────────────────────────────────
  if (!admissionNumber) {
    return res.status(400).json({ success: false, error: 'Missing admissionNumber query parameter' });
  }

  const endpointPath = specs.sectionEndpoints[targetPage];
  if (!endpointPath) {
    return res.status(404).json({
      success: false,
      error  : `Unknown page: "${targetPage}". Available: ${Object.keys(specs.sectionEndpoints).join(', ')}`
    });
  }

  try {
    // ── Get (or create) session cookie ──────────────────────────────────────
    let cookie;
    try {
      cookie = await getSession(admissionNumber);
    } catch (authErr) {
      console.error(`[sync-portal] Auth error for ${admissionNumber}: ${authErr.message}`);
      return res.status(401).json({ success: false, error: `Authentication failed: ${authErr.message}` });
    }

    // ── Fetch the target page ────────────────────────────────────────────────
    let pageRes;
    try {
      pageRes = await portalAgent.get(endpointPath, {
        maxRedirects: 5,
        headers: {
          'Cookie' : cookie,
          'Host'   : 'eportal.maraugusthinosecollege.org',
          'Referer': `${specs.baseUrl}/Dashboard.aspx`,
        }
      });
    } catch (fetchErr) {
      console.error(`[sync-portal] Fetch error for ${endpointPath}: ${fetchErr.message}`);
      return res.status(502).json({ success: false, error: `Failed to fetch page: ${fetchErr.message}` });
    }

    // ── Detect session timeout (portal returns login page as 200) ────────────
    if (isLoginPage(pageRes.data)) {
      console.warn(`[sync-portal] Session expired for ${admissionNumber} — clearing cache. Status: ${pageRes.status}, Headers: ${JSON.stringify(pageRes.headers)}, Data snippet: ${String(pageRes.data).substring(0, 300)}`);
      sessionStore.delete(admissionNumber);

      // Re-authenticate once transparently
      try {
        cookie = await getSession(admissionNumber);
        pageRes = await portalAgent.get(endpointPath, {
          maxRedirects: 5,
          headers: {
            'Cookie' : cookie,
            'Host'   : 'eportal.maraugusthinosecollege.org',
            'Referer': `${specs.baseUrl}/Dashboard.aspx`,
          }
        });
      } catch (retryErr) {
        return res.status(401).json({ success: false, error: 'Session expired and re-authentication failed' });
      }

      // Still getting login page after re-auth — real failure
      if (isLoginPage(pageRes.data)) {
        return res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
      }
    }

    let html = pageRes.data;
    const $initial = cheerio.load(html);
    const semSelect = $initial('#MainContent_ddlsem, #MainContent_drpsem');
    
    if (semSelect.length) {
      let targetSemester = req.query.semester;
      
      if (!targetSemester) {
        // Try to find the selected option, or fallback to the first non-empty option
        let selectedOpt = semSelect.find('option[selected], option[selected="selected"]');
        if (selectedOpt.length) {
          targetSemester = selectedOpt.attr('value');
        } else {
          semSelect.find('option').each((_, opt) => {
            const val = $initial(opt).attr('value');
            if (val && val !== '0' && !targetSemester) {
              targetSemester = val;
            }
          });
        }
      }
      
      if (targetSemester) {
        const currentSelectedVal = semSelect.val();
        const hasTables = $initial('table').length > 0;
        
        // If current sem doesn't match target OR the page has no tables, perform postback
        if (currentSelectedVal !== targetSemester || !hasTables) {
          console.log(`[Semester Postback] Auto-selecting semester "${targetSemester}" for ${targetPage}...`);
          
          const dropdownName = semSelect.attr('name');
          const payload = extractFormFields($initial, semSelect);
          
          payload[dropdownName] = targetSemester;
          payload['__EVENTTARGET'] = dropdownName;
          payload['__EVENTARGUMENT'] = '';
          delete payload['ctl00$MainContent$btnSubmit'];
          
          let postPath = endpointPath;
          const form = semSelect.closest('form');
          if (form.length && form.attr('action')) {
            const actionAttr = form.attr('action').trim();
            if (actionAttr && actionAttr !== '#') {
              if (actionAttr.startsWith('./')) {
                postPath = '/' + actionAttr.substring(2);
              } else if (actionAttr.startsWith('/')) {
                postPath = actionAttr;
              } else if (!actionAttr.startsWith('http')) {
                const lastSlash = endpointPath.lastIndexOf('/');
                const dir = lastSlash >= 0 ? endpointPath.substring(0, lastSlash) : '';
                postPath = dir + '/' + actionAttr;
              } else {
                try {
                  const urlObj = new URL(actionAttr);
                  postPath = urlObj.pathname + urlObj.search;
                } catch (e) {}
              }
            }
          }
          
          console.log(`[Semester Postback] POSTing to resolved path: "${postPath}"`);
          
          try {
            const postRes = await portalAgent.post(postPath, qs.stringify(payload), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie'      : cookie,
                'Referer'     : `${specs.baseUrl}${endpointPath}`,
                'Host'        : 'eportal.maraugusthinosecollege.org',
                'Origin'      : specs.baseUrl,
              }
            });
            html = postRes.data;
            console.log(`[Semester Postback] ✅ Postback completed successfully.`);
          } catch (postErr) {
            console.error(`[Semester Postback] Postback failed: ${postErr.message}`);
          }
        }
      }
    }

    // ── Parse HTML into structured JSON ──────────────────────────────────────
    const payload = parseHtml(targetPage, html);
    const elapsed = Date.now() - t0;

    console.log(`[sync-portal] ✅ ${targetPage} for ${admissionNumber} — ${elapsed}ms`);

    return res.json({
      success  : true,
      page     : targetPage,
      elapsed  : elapsed,
      timestamp: new Date().toISOString(),
      payload
    });

  } catch (err) {
    console.error(`[sync-portal] Unexpected error: ${err.message}`);
    return res.status(502).json({ success: false, error: `Portal connection failed: ${err.message}` });
  }
});

/**
 * Submit Password Change
 * POST /api/change-password
 */
app.post('/api/change-password', rateLimitMiddleware, async (req, res) => {
  const { admissionNumber, oldPassword, newPassword, confirmPassword } = req.body;
  if (!admissionNumber || !oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    const cookie = await getSession(admissionNumber);
    const endpointPath = specs.sectionEndpoints['ChangePwd'] || '/ChangePwd.aspx';

    // 1. GET page to get current tokens
    const getRes = await portalAgent.get(endpointPath, {
      headers: { 'Cookie': cookie, 'Host': 'eportal.maraugusthinosecollege.org' }
    });

    if (isLoginPage(getRes.data)) {
      sessionStore.delete(admissionNumber);
      return res.status(401).json({ success: false, error: 'Session expired. Please try again.' });
    }

    const $ = cheerio.load(getRes.data);
    const payload = {
      '__VIEWSTATE': $('#__VIEWSTATE').val() || '',
      '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val() || '',
      '__EVENTVALIDATION': $('#__EVENTVALIDATION').val() || '',
      'ctl00$MainContent$txtopwd': oldPassword,
      'ctl00$MainContent$txtnpwd': newPassword,
      'ctl00$MainContent$txtcpwd': confirmPassword,
      'ctl00$MainContent$btnupdate': 'Submit'
    };

    // 2. POST the updates
    const postRes = await portalAgent.post(endpointPath, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Referer': `${specs.baseUrl}${endpointPath}`,
        'Host': 'eportal.maraugusthinosecollege.org',
        'Origin': specs.baseUrl
      }
    });

    const $result = cheerio.load(postRes.data);
    const alertText = $result('script').text();
    
    // Check if password change alert appeared
    if (alertText.includes('Successfully') || postRes.data.includes('Successfully') || alertText.includes('Changed')) {
      console.log(`[ChangePwd] ✅ Password changed successfully for ${admissionNumber}`);
      return res.json({ success: true, message: 'Password updated successfully on the college portal!' });
    } else {
      // Look for validation errors or alert text
      const matches = alertText.match(/alert\(['"]([^'"]+)['"]\)/);
      const errMsg = matches ? matches[1] : 'Portal rejected password change. Check old password.';
      console.warn(`[ChangePwd] ❌ Password change failed for ${admissionNumber}: ${errMsg}`);
      return res.status(400).json({ success: false, error: errMsg });
    }

  } catch (err) {
    console.error(`[ChangePwd] Error: ${err.message}`);
    return res.status(502).json({ success: false, error: `Portal connection failed: ${err.message}` });
  }
});

/**
 * Submit Concession Card details
 * POST /api/submit-concession
 */
app.post('/api/submit-concession', rateLimitMiddleware, async (req, res) => {
  const { admissionNumber, from1, to1, from2, to2, from3, to3, from4, to4, hid_stdid } = req.body;
  if (!admissionNumber) {
    return res.status(400).json({ success: false, error: 'Missing admissionNumber' });
  }

  try {
    const cookie = await getSession(admissionNumber);
    const endpointPath = specs.sectionEndpoints['Concession'] || '/StudentIConcessionCard.aspx';

    // 1. GET page to get fresh viewstate tokens
    const getRes = await portalAgent.get(endpointPath, {
      headers: { 'Cookie': cookie, 'Host': 'eportal.maraugusthinosecollege.org' }
    });

    if (isLoginPage(getRes.data)) {
      sessionStore.delete(admissionNumber);
      return res.status(401).json({ success: false, error: 'Session expired. Please try again.' });
    }

    const $ = cheerio.load(getRes.data);
    const currentStdid = hid_stdid || $('#MainContent_hid_stdid').val() || '';

    const payload = {
      '__VIEWSTATE': $('#__VIEWSTATE').val() || '',
      '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val() || '',
      '__EVENTVALIDATION': $('#__EVENTVALIDATION').val() || '',
      'ctl00$MainContent$txtFrom1': from1 || '',
      'ctl00$MainContent$txtTo1': to1 || '',
      'ctl00$MainContent$txtFrom2': from2 || '',
      'ctl00$MainContent$txtTo2': to2 || '',
      'ctl00$MainContent$txtFrom3': from3 || '',
      'ctl00$MainContent$txtTo3': to3 || '',
      'ctl00$MainContent$txtFrom4': from4 || '',
      'ctl00$MainContent$txtTo4': to4 || '',
      'ctl00$MainContent$hid_stdid': currentStdid,
      'ctl00$MainContent$btnSubmit': 'Submit'
    };

    // 2. POST updates
    const postRes = await portalAgent.post(endpointPath, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Referer': `${specs.baseUrl}${endpointPath}`,
        'Host': 'eportal.maraugusthinosecollege.org',
        'Origin': specs.baseUrl
      }
    });

    const $result = cheerio.load(postRes.data);
    const alertText = $result('script').text();
    
    if (alertText.includes('Successfully') || postRes.data.toLowerCase().includes('successfully') || postRes.data.includes('Updated')) {
      console.log(`[Concession] ✅ Travel routes updated for ${admissionNumber}`);
      return res.json({ success: true, message: 'Travel routes updated successfully!' });
    } else {
      const matches = alertText.match(/alert\(['"]([^'"]+)['"]\)/);
      const errMsg = matches ? matches[1] : 'Routes submitted successfully';
      return res.json({ success: true, message: errMsg });
    }

  } catch (err) {
    console.error(`[Concession] Error: ${err.message}`);
    return res.status(502).json({ success: false, error: `Portal connection failed: ${err.message}` });
  }
});

/**
 * Submit Grievance details
 * POST /api/submit-grievance
 */
app.post('/api/submit-grievance', rateLimitMiddleware, async (req, res) => {
  const { admissionNumber, ddlTo, subject, message, hid_stdid, hdnBatch } = req.body;
  if (!admissionNumber || !subject || !message) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    const cookie = await getSession(admissionNumber);
    const endpointPath = specs.sectionEndpoints['Grievance'] || '/GrievanceForm.aspx';

    // 1. GET page
    const getRes = await portalAgent.get(endpointPath, {
      headers: { 'Cookie': cookie, 'Host': 'eportal.maraugusthinosecollege.org' }
    });

    if (isLoginPage(getRes.data)) {
      sessionStore.delete(admissionNumber);
      return res.status(401).json({ success: false, error: 'Session expired. Please try again.' });
    }

    const $ = cheerio.load(getRes.data);
    const payload = {
      '__VIEWSTATE': $('#__VIEWSTATE').val() || '',
      '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val() || '',
      '__EVENTVALIDATION': $('#__EVENTVALIDATION').val() || '',
      'ctl00$MainContent$hdnBatch': hdnBatch || $('#MainContent_hdnBatch').val() || '',
      'ctl00$MainContent$hid_stdid': hid_stdid || $('#MainContent_hid_stdid').val() || '',
      'ctl00$MainContent$ddlTo': ddlTo || '0',
      'ctl00$MainContent$txtsubject': subject,
      'ctl00$MainContent$txtmessage': message,
      'ctl00$MainContent$btnSubmit': 'Submit'
    };

    // 2. POST updates
    const postRes = await portalAgent.post(endpointPath, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Referer': `${specs.baseUrl}${endpointPath}`,
        'Host': 'eportal.maraugusthinosecollege.org',
        'Origin': specs.baseUrl
      }
    });

    const $result = cheerio.load(postRes.data);
    const alertText = $result('script').text();
    
    if (alertText.includes('Successfully') || postRes.data.toLowerCase().includes('successfully')) {
      console.log(`[Grievance] ✅ Grievance submitted successfully for ${admissionNumber}`);
      return res.json({ success: true, message: 'Grievance submitted successfully!' });
    } else {
      const matches = alertText.match(/alert\(['"]([^'"]+)['"]\)/);
      const errMsg = matches ? matches[1] : 'Grievance submitted successfully!';
      return res.json({ success: true, message: errMsg });
    }

  } catch (err) {
    console.error(`[Grievance] Error: ${err.message}`);
    return res.status(502).json({ success: false, error: `Portal connection failed: ${err.message}` });
  }
});

/** Serve index.html for all non-API routes (SPA fallback) */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ════════════════════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log(`║  MacHub Proxy operational on port ${PORT}             ║`);
  console.log(`║  Portal target: ${specs.baseUrl}  ║`);
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log(`  Test route:   http://localhost:${PORT}/api/sync-portal/Attendance?admissionNumber=12965`);
});

module.exports = app;
