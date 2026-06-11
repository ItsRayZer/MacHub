/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Cloudflare Worker — Entry Point                        ║
 * ║   Routes: GET /health, POST /api/scrape/:section                ║
 * ║   Target latency: <1500ms per scrape, <2000ms on first login    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { getSession, invalidateSession, mintCustomToken, isLoginPage } from './auth.js';
import { SCRAPERS, scrapePage } from './scraper.js';
import { SPECS } from './specs.js';
import * as cheerio from 'cheerio';
import { parseHtml } from './parser.js';

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body, status = 200, extra = {}) {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        ...extra,
      },
    }
  );
}

function errorResponse(message, status = 500, extra = {}) {
  return corsResponse({ success: false, error: message }, status, extra);
}

// ─── Request Router ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // ── GET /health ──────────────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/health') {
        return corsResponse({
          status: 'online',
          service: 'MacHub Proxy',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
        });
      }

      // ── GET /api/sync-portal/:targetPage ──────────────────────────────────────
      const syncPortalMatch = pathname.match(/^\/api\/sync-portal\/([a-zA-Z]+)$/);
      if (request.method === 'GET' && syncPortalMatch) {
        const targetPage = syncPortalMatch[1];
        const admissionNumber = (url.searchParams.get('admissionNumber') || '').trim();
        const customPassword = String(url.searchParams.get('password') || '').trim();
        const targetSemester = (url.searchParams.get('semester') || '').trim();

        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        let endpointPath = SPECS.sectionEndpoints[targetPage];
        if (targetPage === 'Attendance') {
          endpointPath = SPECS.sectionEndpoints['AttendanceSubjectWise'] || '/AttendanceDetails_New.aspx';
        }
        if (!endpointPath && targetPage === 'SubjectWiseAttendance') {
          endpointPath = SPECS.sectionEndpoints['AttendanceSubjectWise'];
        }
        if (!endpointPath && targetPage === 'AttendanceSubjectWise') {
          endpointPath = SPECS.sectionEndpoints['SubjectWiseAttendance'];
        }

        if (!endpointPath) {
          return errorResponse(`Unknown page: ${targetPage}`, 404);
        }

        try {
          const cookie = await getSession(admissionNumber, customPassword);

          // ── Attendance pages: use dedicated scrapers (handles full 2-step postback) ──
          const ATTENDANCE_PAGES = ['Attendance', 'AttendanceDetails', 'SubjectWiseAttendance', 'AttendanceSubjectWise'];
          if (ATTENDANCE_PAGES.includes(targetPage)) {
            const t0 = Date.now();
            const semArg = targetSemester || null;

            // Run subject-wise first, then date-log details (with 150ms gap for ASP.NET session lock)
            const subjectWise = await SCRAPERS.attendanceSubjectWise(admissionNumber, cookie, {}, semArg);
            await new Promise(resolve => setTimeout(resolve, 150));
            const details = await SCRAPERS.attendanceDetails(admissionNumber, cookie, {}, semArg);

            const isDetails = (targetPage === 'AttendanceDetails');
            return corsResponse({
              success: true,
              page: targetPage,
              timestamp: new Date().toISOString(),
              elapsed: Date.now() - t0,
              payload: {
                page: targetPage,
                sections: isDetails ? details.sections : subjectWise.sections,
                data: isDetails ? details.data : subjectWise.data,
                subjectSummary: subjectWise.sections,
                detailsLog: details.sections,
                semesters: details.semesters?.length ? details.semesters : subjectWise.semesters,
                semesterOptions: details.semesters?.length ? details.semesters : subjectWise.semesters,
                meta: details.meta,
              }
            });
          }

          // Fetch the page (generic non-attendance path)
          const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
          const pageUrl = PORTAL_BASE + endpointPath;

          let pageRes = await fetch(pageUrl, {
            method: 'GET',
            headers: {
              'Cookie': cookie,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Host': 'eportal.maraugusthinosecollege.org',
              'Referer': `${SPECS.baseUrl}/Dashboard.aspx`,
            },
            redirect: 'manual',
          });

          let html = await pageRes.text();
          if (isLoginPage(html) || pageRes.status === 302) {
            throw new Error('SESSION_EXPIRED');
          }

          // Check dropdown/semester postback
          const $initial = cheerio.load(html);
          const semSelect = $initial('#MainContent_ddlsem, #MainContent_drpsem, #ContentPlaceHolder2_drpsemforma');
          
          if (semSelect.length) {
            let semValue = targetSemester;
            if (!semValue) {
              // Find selected or last option
              let selectedOpt = semSelect.find('option[selected], option[selected="selected"]');
              if (selectedOpt.length && selectedOpt.attr('value') !== '0') {
                semValue = selectedOpt.attr('value');
              } else {
                semSelect.find('option').each((_, opt) => {
                  const val = $initial(opt).attr('value');
                  if (val && val !== '0') semValue = val;
                });
              }
            }

            if (semValue) {
              const currentSelectedVal = semSelect.val();
              const hasTables = $initial('table').length > 0;
              const isAttendance = ['Attendance', 'AttendanceDetails', 'SubjectWiseAttendance', 'AttendanceSubjectWise'].includes(targetPage);

              if (isAttendance || currentSelectedVal !== semValue || !hasTables) {
                // Perform postback
                const dropdownName = semSelect.attr('name') || 'ctl00$MainContent$ddlsem';
                
                // Extract all form fields
                const finalPayload = {};
                $initial('input, select, textarea').each((_, el) => {
                  const name = $initial(el).attr('name');
                  if (!name) return;
                  const type = $initial(el).attr('type');
                  const val = $initial(el).val();

                  if (type === 'checkbox' || type === 'radio') {
                    if ($initial(el).prop('checked')) finalPayload[name] = val || 'on';
                  } else {
                    finalPayload[name] = val || '';
                  }
                });

                finalPayload[dropdownName] = semValue;

                if (isAttendance) {
                  const submitName = $initial('input[type="submit"]').first().attr('name') || 'ctl00$MainContent$btnsubmit';
                  finalPayload[submitName] = 'Submit';
                  finalPayload['__EVENTTARGET'] = '';
                  finalPayload['__EVENTARGUMENT'] = '';

                  // Propagate student ID
                  const stdId = $initial('#MainContent_hid_student').val() || 
                                $initial('#MainContent_hdstdid').val() || 
                                $initial('input[name*="student"]').val() || 
                                $initial('input[name*="stdid"]').val();

                  if (stdId && stdId !== '0') {
                    Object.keys(finalPayload).forEach(key => {
                      const lowerKey = key.toLowerCase();
                      if (lowerKey.includes('student') || lowerKey.includes('stdid')) {
                        const currentVal = String(finalPayload[key]).trim();
                        if (currentVal === '0' || currentVal === '' || currentVal === 'undefined') {
                          finalPayload[key] = stdId;
                        }
                      }
                    });
                    const commonKeys = ['ctl00$MainContent$hid_student', 'ctl00$MainContent$hdstdid', 'ctl00$MainContent$hidsemsub'];
                    commonKeys.forEach(k => {
                      const v = String(finalPayload[k] || '').trim();
                      if (v === '' || v === '0') finalPayload[k] = stdId;
                    });
                  }
                } else {
                  finalPayload['__EVENTTARGET'] = dropdownName;
                  finalPayload['__EVENTARGUMENT'] = '';
                  delete finalPayload['ctl00$MainContent$btnSubmit'];
                }

                // Determine form action URL if specified
                let postPath = endpointPath;
                const form = $initial('form').first();
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

                const encodedPayload = new URLSearchParams(finalPayload).toString();
                const postRes = await fetch(PORTAL_BASE + postPath, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie,
                    'Referer': pageUrl,
                    'Host': 'eportal.maraugusthinosecollege.org',
                    'Origin': PORTAL_BASE,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  },
                  body: encodedPayload,
                  redirect: 'manual',
                });

                html = await postRes.text();
                if (isLoginPage(html) || postRes.status === 302) {
                  throw new Error('SESSION_EXPIRED');
                }
              }
            }
          }

          // Parse HTML using parser.js functions
          const payload = parseHtml(targetPage, html);

          return corsResponse({
            success: true,
            page: targetPage,
            timestamp: new Date().toISOString(),
            payload
          });

        } catch (err) {
          if (err.message === 'SESSION_EXPIRED') {
            return errorResponse('SESSION_EXPIRED', 401);
          }
          console.error(`[Worker sync-portal] Error: ${err.message}`);
          return errorResponse(err.message || 'Sync failed', 500);
        }
      }

      // ── POST /api/auth/login ──────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/login') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || body.admission_no || '').trim();
        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        try {
          // Step 1: Perform portal login handshake
          await getSession(admissionNumber, body.password);

          // Step 2: Mint custom Firebase auth token
          const token = await mintCustomToken(admissionNumber, env);

          return corsResponse({
            success: true,
            token,
            admissionNumber
          });
        } catch (err) {
          console.error(`[Worker] Auth failed for ${admissionNumber}: ${err.message}`);
          return errorResponse(err.message || 'Authentication failed', 401);
        }
      }

      // ── POST /api/auth/verify ─────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/verify') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || body.admission_no || '').trim();
        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        try {
          const cookie = await getSession(admissionNumber, body.password);
          // Verify session by fetching dashboard
          const verifyRes = await fetch(`${SPECS.baseUrl}${SPECS.sectionEndpoints.Dashboard}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Host': 'eportal.maraugusthinosecollege.org',
              'Cookie': cookie,
            },
            redirect: 'manual',
          });
          const html = await verifyRes.text();
          if (isLoginPage(html) || verifyRes.status === 302) {
            return corsResponse({ success: false, error: 'SESSION_EXPIRED' });
          }
          return corsResponse({ success: true });
        } catch (err) {
          return corsResponse({ success: false, error: err.message });
        }
      }

      // ── POST /api/scrape/studyMaterialDetail ──────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/scrape/studyMaterialDetail') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const path = String(body.path || '').trim();
        if (!admissionNumber || !path) {
          return errorResponse('admissionNumber and path are required', 400);
        }
        try {
          const cookie = await getSession(admissionNumber, body.password);
          // Scrape the sub-page using scrapePage helper
          const parsed = await scrapePage('StudyMaterialDetail', path, cookie);
          return corsResponse({
            success: true,
            data: parsed,
            page: 'StudyMaterialDetail',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          return errorResponse(err.message || 'Failed to fetch details', 500);
        }
      }

      // ── POST /api/scrape/attendance (Combined) ───────────────────────────────
      if (request.method === 'POST' && pathname.toLowerCase() === '/api/scrape/attendance') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        const runCombinedScrape = async (isRetry = false) => {
          try {
            const cookie = await getSession(admissionNumber, body.password);
            
            // 1. Fetch Subject Wise data first
            const subjectWise = await SCRAPERS.attendanceSubjectWise(admissionNumber, cookie, body);
            
            // 2. Introduce a 200ms sleep buffer to release the ASP.NET session lock state gracefully
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 3. Fetch detailed date logs
            const details = await SCRAPERS.attendanceDetails(admissionNumber, cookie, body);

            const payload = {
              page: "Attendance",
              sections: subjectWise.sections,
              data: subjectWise.data,
              subjectSummary: subjectWise.sections,
              detailsLog: details.sections,
              semesters: details.semesters?.length ? details.semesters : subjectWise.semesters,
              semesterOptions: details.semesters?.length ? details.semesters : subjectWise.semesters,
              meta: details.meta,
            };

            return corsResponse({
              success: true,
              details,
              subjectWise,
              data: payload
            });
          } catch (err) {
            if (err.message === 'SESSION_EXPIRED' && !isRetry) {
              console.log(`[Worker] Session expired during combined attendance scrape for ${admissionNumber}, retrying...`);
              invalidateSession(admissionNumber);
              return runCombinedScrape(true);
            }
            throw err;
          }
        };

        try {
          return await runCombinedScrape();
        } catch (err) {
          return errorResponse(err.message || 'Combined scrape failed', 500);
        }
      }

      // ── POST /api/scrape/:section ────────────────────────────────────────────
      const scrapeMatch = pathname.match(/^\/api\/scrape\/([a-zA-Z]+)$/);
      if (request.method === 'POST' && scrapeMatch) {
        const section = scrapeMatch[1];

        // Parse request body
        let body;
        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON body', 400);
        }

        const admissionNumber = String(body.admissionNumber || body.admission_no || '').trim();
        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        // Normalize section name from Client API (Capitalized/lowercase) to match Worker SCRAPERS keys
        let targetSection = section.charAt(0).toLowerCase() + section.slice(1);
        if (targetSection === 'feePay') targetSection = 'feePayment';
        if (targetSection === 'feedBack') targetSection = 'feedback';
        if (targetSection === 'internalToUniversity') targetSection = 'internalUniversity';

        // Validate section
        const scraperFn = SCRAPERS[targetSection];
        if (!scraperFn) {
          return errorResponse(`Unknown section: ${section}. Valid sections: ${Object.keys(SCRAPERS).join(', ')}`, 404);
        }

        // Execute with automatic session retry
        const result = await executeScrape(targetSection, scraperFn, admissionNumber, body);
        return result;
      }

      // ── POST /api/session/clear ──────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/session/clear') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const adm = String(body.admissionNumber || '').trim();
        if (adm) {
          invalidateSession(adm);
          return corsResponse({ success: true, message: `Session cleared for ${adm}` });
        }
        return corsResponse({ success: true, message: 'No admission number provided' });
      }

      return errorResponse('Not found', 404);
    } catch (globalErr) {
      console.error(`[Worker Global Error]`, globalErr);
      return errorResponse(`Global Worker crash: ${globalErr.message}`, 500);
    }
  },
};

/**
 * Execute a scrape with automatic session retry on SESSION_EXPIRED.
 */
async function executeScrape(section, scraperFn, admissionNumber, body = {}, isRetry = false) {
  try {
    const cookie = await getSession(admissionNumber, body.password);
    const data = await scraperFn(admissionNumber, cookie, body);

    return corsResponse({
      success: true,
      section,
      admissionNumber,
      data: data,
      page: data.page,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    const msg = err.message || 'Unknown error';

    // Session expired — retry once with fresh session
    if (msg === 'SESSION_EXPIRED' && !isRetry) {
      console.log(`[Worker] Session expired for ${admissionNumber}, retrying...`);
      invalidateSession(admissionNumber);
      return executeScrape(section, scraperFn, admissionNumber, body, true);
    }

    // Login failures → 401
    if (msg.includes('LOGIN_FAILED') || (msg === 'SESSION_EXPIRED' && isRetry)) {
      return errorResponse('Invalid admission number or portal login failed', 401);
    }

    // Portal unreachable → 502
    if (msg.includes('PORTAL_ERROR') || msg.includes('fetch failed') || msg.includes('unreachable')) {
      return errorResponse('College portal is currently unreachable', 502);
    }

    // Page not found → 404 (but still return success with empty data)
    if (msg.includes('PAGE_NOT_FOUND')) {
      return corsResponse({
        success: true,
        section,
        admissionNumber,
        data: { tables: [] },
        page: section,
        note: 'Page not available on portal',
        timestamp: new Date().toISOString(),
      });
    }

    console.error(`[Worker] Error scraping ${section} for ${admissionNumber}: ${msg}`);
    return errorResponse(`Failed to fetch ${section}: ${msg}`, 500);
  }
}
