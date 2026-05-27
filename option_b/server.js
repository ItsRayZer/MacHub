const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://eportal.maraugusthinosecollege.org';

// ── SESSION CACHE WITH 20-MIN TTL ───────────────────────────────────────────
const sessionCache = {};
const SESSION_TTL = 20 * 60 * 1000; // 20 minutes in milliseconds

function getCachedSession(admissionNo) {
    const entry = sessionCache[admissionNo];
    if (entry && (Date.now() - entry.timestamp) < SESSION_TTL) {
        return entry.cookie;
    }
    delete sessionCache[admissionNo];
    return null;
}

function cacheSession(admissionNo, cookie) {
    sessionCache[admissionNo] = {
        cookie,
        timestamp: Date.now()
    };
}

// ── AXIOS CLIENT INSTANCE FOR PORTAL CONNECTIONS ────────────────────────────
function createPortalClient(cookie = '') {
    const client = axios.create({
        baseURL: BASE_URL,
        timeout: 10000, // 10 seconds timeout safety
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': cookie
        },
        maxRedirects: 0 // We handle redirects manually for login check
    });

    return client;
}

// ── PHASE 1: THE AUTHENTICATION HANDSHAKE ──────────────────────────────────
async function performLoginHandshake(admissionNo, password = admissionNo) {
    const client = createPortalClient();

    // 1. Pre-flight Scrape
    let loginPageHtml;
    try {
        const preflightRes = await client.get('/Login.aspx');
        loginPageHtml = preflightRes.data;
    } catch (err) {
        throw new Error(`Portal login page unreachable: ${err.message}`);
    }

    const $ = cheerio.load(loginPageHtml);
    const viewstate = $('#__VIEWSTATE').val() || '';
    const viewstateGen = $('#__VIEWSTATEGENERATOR').val() || '';
    const eventValidation = $('#__EVENTVALIDATION').val() || '';

    // Detect field names dynamically or fallback to standard ones
    const uField = $('input[type="text"]').attr('name') || 'txtusername';
    const pField = $('input[type="password"]').attr('name') || 'txtpassword';
    const submitBtn = $('input[type="submit"]');
    const sField = submitBtn.attr('name') || 'Submit';
    const sVal = submitBtn.attr('value') || 'Login';

    const loginPayload = {
        __VIEWSTATE: viewstate,
        __VIEWSTATEGENERATOR: viewstateGen,
        __EVENTVALIDATION: eventValidation,
        [uField]: admissionNo,
        [pField]: password,
        [sField]: sVal
    };

    // 2. Login Execution
    let loginResponse;
    try {
        loginResponse = await client.post('/Login.aspx', qs.stringify(loginPayload), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: (status) => status === 200 || status === 302 // Allow redirects
        });
    } catch (err) {
        throw new Error(`Login request failed: ${err.message}`);
    }

    // Intercept Session Cookie
    const cookies = loginResponse.headers['set-cookie'];
    if (!cookies || cookies.length === 0) {
        throw new Error('MANUAL_PASSWORD_REQUIRED');
    }

    // Capture the ASP.NET_SessionId cookie
    const sessionCookie = cookies.find(c => c.includes('ASP.NET_SessionId')) || cookies[0];
    const cleanedCookie = sessionCookie.split(';')[0];

    // Double check authentication by loading the Dashboard
    const verifyClient = createPortalClient(cleanedCookie);
    let dashRes;
    try {
        dashRes = await verifyClient.get('/Dashboard.aspx', {
            validateStatus: (status) => status === 200
        });
    } catch {
        throw new Error('MANUAL_PASSWORD_REQUIRED');
    }

    // Parse dashboard to confirm login success
    const dash$ = cheerio.load(dashRes.data);
    const isLoginScreen = dash$('input[type="password"]').length > 0 || dashRes.data.includes('Login');
    if (isLoginScreen) {
        throw new Error('MANUAL_PASSWORD_REQUIRED');
    }

    cacheSession(admissionNo, cleanedCookie);
    return cleanedCookie;
}

// ── GET CLIENT WITH AUTOREFRESH INTERCEPTOR ──────────────────────────────────
function getSessionClient(admissionNo, cookie) {
    const client = createPortalClient(cookie);

    // Axios Interceptor for Silent Re-Authentication
    client.interceptors.response.use(
        (response) => {
            // Check if page redirected back to login or contains login forms (sign of expired session)
            if (typeof response.data === 'string' && (response.data.includes('Login.aspx') || response.data.includes('txtusername'))) {
                return handleSessionExpired(admissionNo, response.config);
            }
            return response;
        },
        async (error) => {
            const { response, config } = error;
            // 302 Redirect or 401 Unauthorized signals expired session
            if ((response && (response.status === 302 || response.status === 401)) || error.code === 'ECONNABORTED') {
                if (response && response.headers.location && response.headers.location.includes('Login.aspx')) {
                    return handleSessionExpired(admissionNo, config);
                }
            }
            return Promise.reject(error);
        }
    );

    return client;
}

async function handleSessionExpired(admissionNo, originalConfig) {
    console.log(`[Session Expired] Re-authenticating silently for student: ${admissionNo}`);
    try {
        const newCookie = await performLoginHandshake(admissionNo);
        // Retry original request with the new cookie
        originalConfig.headers['Cookie'] = newCookie;
        return axios(originalConfig);
    } catch (err) {
        return Promise.reject(err);
    }
}

// ── PHASE 2: PARSING UTILITIES ──────────────────────────────────────────────
function parseDashboard(html) {
    const $ = cheerio.load(html);
    const result = {
        counters: { study_material: 0, assessment: 0, assignment: 0, seminar: 0 },
        profile: { student_name: 'Student', semester: 'Sem 2' }
    };

    // Extract student name
    $('div, span, p, td').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 5 && text.length < 40 && text === text.toUpperCase() && /^[A-Z\s]+$/.test(text)) {
            if (!['DASHBOARD', 'EDULOOM', 'EXAM'].some(w => text.includes(w))) {
                result.profile.student_name = text;
                return false; // break loop
            }
        }
    });

    // Extract counters
    const cardLabels = {
        'study material': 'study_material',
        'assessment': 'assessment',
        'assignment': 'assignment',
        'seminar': 'seminar'
    };

    // Parse all text lines to search for key labels and nearby numeric values
    const lines = [];
    $('*').each((_, el) => {
        if ($(el).children().length === 0) {
            const t = $(el).text().trim();
            if (t) lines.push(t);
        }
    });

    lines.forEach((line, i) => {
        const lowerLine = line.toLowerCase();
        for (const [label, key] of Object.entries(cardLabels)) {
            if (lowerLine === label) {
                // Look for nearby numbers
                for (let offset = -3; offset <= 3; offset++) {
                    const idx = i + offset;
                    if (idx >= 0 && idx < lines.length) {
                        if (/^\d+$/.test(lines[idx])) {
                            result.counters[key] = parseInt(lines[idx], 10);
                            break;
                        }
                    }
                }
            }
        }
    });

    return result;
}

function parseStudyMaterial(html) {
    const $ = cheerio.load(html);
    const subjects = [];

    // Find grids/tables
    $('table').each((_, table) => {
        const rows = $(table).find('tr');
        if (rows.length < 2) return;

        const headers = [];
        $(rows[0]).find('th, td').each((_, cell) => {
            headers.push($(cell).text().trim().toLowerCase());
        });

        // Ensure this is the subjects/study material table
        const hasSubject = headers.some(h => h.includes('subject') || h.includes('course'));
        if (!hasSubject) return;

        rows.slice(1).each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length === 0) return;

            const record = { subject_name: '', subject_code: '', semester: 'Sem 2', category: 'Core Course' };
            
            cells.each((i, cell) => {
                const header = headers[i] || '';
                const val = $(cell).text().trim();

                if (header.includes('subject') || header.includes('name')) {
                    // Try to split code in bracket if present e.g. "Data Structures (MG2CCRBCA101)"
                    const match = val.match(/^(.+?)\s*\(([^)]+)\)$/);
                    if (match) {
                        record.subject_name = match[1].trim();
                        record.subject_code = match[2].trim();
                    } else {
                        record.subject_name = val;
                    }
                } else if (header.includes('code')) {
                    record.subject_code = val;
                } else if (header.includes('semester')) {
                    record.semester = val;
                } else if (header.includes('category') || header.includes('type')) {
                    record.category = val;
                }
            });

            if (record.subject_name) {
                subjects.push(record);
            }
        });
    });

    return subjects;
}

function parseAssessments(html) {
    const $ = cheerio.load(html);
    const assessments = [];

    $('table').each((_, table) => {
        const rows = $(table).find('tr');
        if (rows.length < 2) return;

        // Find subject name from preceding headings
        let subjectName = '';
        let sibling = $(table).prev();
        while (sibling.length > 0) {
            const hText = sibling.text().trim();
            if (hText && hText.length > 4 && !/^\d+$/.test(hText)) {
                subjectName = hText.replace(/\s*\([^)]+\)/g, '').trim(); // Remove course code inside parentheses
                break;
            }
            sibling = sibling.prev();
        }

        if (!subjectName) subjectName = 'Unknown Subject';

        const headers = [];
        $(rows[0]).find('th, td').each((_, cell) => {
            headers.push($(cell).text().trim().toLowerCase());
        });

        rows.slice(1).each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length === 0) return;

            const record = {
                subject: subjectName,
                assessment_type: '',
                score: '',
                max_mark: '',
                pass_mark: '',
                status: ''
            };

            cells.each((i, cell) => {
                const header = headers[i] || '';
                const val = $(cell).text().trim();

                if (header.includes('type') || header.includes('assessment') || header.includes('exam')) {
                    record.assessment_type = val;
                } else if (header.includes('score') || header.includes('mark') || header.includes('obtained')) {
                    record.score = val;
                } else if (header.includes('max') || header.includes('total')) {
                    record.max_mark = val;
                } else if (header.includes('pass')) {
                    record.pass_mark = val;
                } else if (header.includes('status') || header.includes('result')) {
                    record.status = val;
                }
            });

            // Default fallback if headers did not match
            if (!record.assessment_type && cells.length >= 5) {
                record.assessment_type = $(cells[0]).text().trim();
                record.score = $(cells[1]).text().trim();
                record.max_mark = $(cells[2]).text().trim();
                record.pass_mark = $(cells[3]).text().trim();
                record.status = $(cells[4]).text().trim();
            }

            if (record.assessment_type || record.score) {
                assessments.push(record);
            }
        });
    });

    return assessments;
}

// ── SYNC CONTROLLER ─────────────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
    const { admissionNo } = req.body;
    if (!admissionNo) {
        return res.status(400).json({ error: 'admissionNo is required' });
    }

    let cookie = getCachedSession(admissionNo);
    let errors = [];

    // Trigger silent login if session is not cached
    if (!cookie) {
        try {
            cookie = await performLoginHandshake(admissionNo);
        } catch (err) {
            if (err.message === 'MANUAL_PASSWORD_REQUIRED') {
                return res.status(403).json({ error: 'MANUAL_PASSWORD_REQUIRED' });
            }
            return res.status(500).json({ error: `Portal connection failed: ${err.message}` });
        }
    }

    const client = getSessionClient(admissionNo, cookie);

    // Perform concurrent fetches via Promise.allSettled()
    const fetches = [
        client.get('/Dashboard.aspx').then(r => parseDashboard(r.data)),
        client.get('/StudyMaterial.aspx').then(r => parseStudyMaterial(r.data)),
        client.get('/StdAssessmentNew.aspx').then(r => parseAssessments(r.data))
    ];

    const results = await Promise.allSettled(fetches);

    let dashboard = { counters: { study_material: 0, assessment: 0, assignment: 0, seminar: 0 }, profile: { student_name: 'Student', semester: 'Sem 2' } };
    let subjects = [];
    let assessments = [];

    // Dashboard handling
    if (results[0].status === 'fulfilled') {
        dashboard = results[0].value;
    } else {
        errors.push({ endpoint: 'Dashboard', error: results[0].reason.message });
    }

    // Subjects handling
    if (results[1].status === 'fulfilled') {
        subjects = results[1].value;
    } else {
        errors.push({ endpoint: 'StudyMaterial', error: results[1].reason.message });
    }

    // Assessments handling
    if (results[2].status === 'fulfilled') {
        assessments = results[2].value;
    } else {
        errors.push({ endpoint: 'StdAssessmentNew', error: results[2].reason.message });
    }

    // Assemble unified JSON payload
    const payload = {
        status: "success",
        timestamp: new Date().toISOString(),
        meta: {
            admission_no: admissionNo,
            student_name: dashboard.profile.student_name,
            sync_engine: "Machin Express Bridge (Option B)"
        },
        dashboard: {
            study_material: dashboard.counters.study_material,
            assessment: dashboard.counters.assessment,
            assignment: dashboard.counters.assignment,
            seminar: dashboard.counters.seminar,
            active_courses: subjects
        },
        profile: {
            name: dashboard.profile.student_name,
            admission_no: admissionNo,
            semester: dashboard.profile.semester
        },
        subjects,
        assessments,
        assignments: [], // Empty states as empty arrays per spec
        seminars: [],
        hall_ticket: null,
        errors: errors.length > 0 ? errors : undefined
    };

    res.json(payload);
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Option B Backend Bridge listening on port ${PORT}`);
});
