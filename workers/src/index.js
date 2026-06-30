/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Cloudflare Worker — Entry Point                        ║
 * ║   Routes: GET /health, POST /api/scrape/:section                ║
 * ║   Target latency: <1500ms per scrape, <2000ms on first login    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { getSession, invalidateSession, mintCustomToken, isLoginPage, encryptAES, decryptAES, getStudentDoc, updateStudentDoc, verifyProfileData, generateQrToken, verifyQrToken, verifyFirebaseIdToken } from './auth.js';
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
          const semSelect = $initial('#MainContent_ddlsem, #MainContent_drpsem, #ContentPlaceHolder2_drpsemforma, #MainContent_drop_exam, #MainContent_drp_exam, select[name*="sem"], select[name*="exam"]');
          
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
          const cookie = await getSession(admissionNumber, body.password);

          // Step 2: Mint custom Firebase auth token
          const token = await mintCustomToken(admissionNumber, env);

          // Scrape profile details so client doesn't need to read Firestore
          let profile = null;
          try {
            profile = await scrapePage('Profile', null, cookie);
          } catch (e) {
            console.warn('Failed to scrape profile on login:', e.message);
          }

          return corsResponse({
            success: true,
            token,
            admissionNumber,
            profile
          });
        } catch (err) {
          console.error(`[Worker] Auth failed for ${admissionNumber}: ${err.message}`);
          return errorResponse(err.message || 'Authentication failed', 401);
        }
      }

      // ── POST /api/auth/update-student ──────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/update-student') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const fields = body.fields || {};
        const deviceToken = String(body.deviceToken || '').trim();
        const password = String(body.password || '').trim();

        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        try {
          // 1. Fetch current student document from Firestore via REST
          let currentDoc = null;
          try {
            currentDoc = await getStudentDoc(admissionNumber, env);
          } catch (e) {
            // Document doesn't exist yet (e.g., manual onboarding)
          }

          // 2. Authorization Check
          let authorized = false;

          // Check for Authorization Bearer token (Firebase ID Token)
          const authHeader = request.headers.get('Authorization') || '';
          if (authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.substring(7);
            const verifiedUid = await verifyFirebaseIdToken(idToken, env);
            if (verifiedUid === `student_${admissionNumber}`) {
              authorized = true;
            }
          }

          if (!authorized) {
            if (!currentDoc || !currentDoc.security?.isProfileClaimed) {
              // If profile is NOT claimed, allow write if:
              // - Password is provided and verified against the portal
              if (password) {
                await getSession(admissionNumber, password);
                authorized = true;
              } else {
                // Onboarding: allow creating profile search details
                // Only allow writing base profile info, not security settings!
                if (fields.security?.isProfileClaimed === true) {
                  return errorResponse('Unauthorized to claim profile without password verification', 403);
                }
                authorized = true; // allow manual onboarding creation
              }
            } else {
              // Profile is claimed: verify either password or registered deviceToken
              const claimedDeviceTokens = currentDoc.security.deviceTokens || [];
              if (deviceToken && claimedDeviceTokens.includes(deviceToken)) {
                authorized = true;
              } else if (password) {
                await getSession(admissionNumber, password);
                authorized = true;
              }
            }
          }

          if (!authorized) {
            return errorResponse('Unauthorized write attempt', 403);
          }

          // 3. Perform update/merge write to Firestore using Service Account privileges
          await updateStudentDoc(admissionNumber, fields, env);

          return corsResponse({ success: true });
        } catch (err) {
          console.error(`[Worker update-student] Failed for ${admissionNumber}: ${err.message}`);
          return errorResponse(err.message || 'Update failed', 500);
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

      // ── POST /api/change-password ───────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/change-password') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const oldPassword = String(body.oldPassword || '').trim();
        const newPassword = String(body.newPassword || '').trim();
        const confirmPassword = String(body.confirmPassword || '').trim();

        if (!admissionNumber || !oldPassword || !newPassword || !confirmPassword) {
          return errorResponse('Missing required parameters', 400);
        }

        try {
          const cookie = await getSession(admissionNumber, oldPassword);
          const endpointPath = SPECS.sectionEndpoints['ChangePwd'] || '/ChangePwd.aspx';

          // 1. GET page to extract ASP.NET token fields
          const getRes = await fetch(`${SPECS.baseUrl}${endpointPath}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': cookie,
              'Host': 'eportal.maraugusthinosecollege.org'
            }
          });

          const html = await getRes.text();
          if (isLoginPage(html)) {
            invalidateSession(admissionNumber);
            return errorResponse('Session expired. Please try again.', 401);
          }

          const $ = cheerio.load(html);
          const payload = new URLSearchParams({
            '__VIEWSTATE': $('#__VIEWSTATE').val() || '',
            '__VIEWSTATEGENERATOR': $('#__VIEWSTATEGENERATOR').val() || '',
            '__EVENTVALIDATION': $('#__EVENTVALIDATION').val() || '',
            'ctl00$MainContent$txtopwd': oldPassword,
            'ctl00$MainContent$txtnpwd': newPassword,
            'ctl00$MainContent$txtcpwd': confirmPassword,
            'ctl00$MainContent$btnupdate': 'Submit'
          });

          // 2. POST the updates
          const postRes = await fetch(`${SPECS.baseUrl}${endpointPath}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': cookie,
              'Referer': `${SPECS.baseUrl}${endpointPath}`,
              'Host': 'eportal.maraugusthinosecollege.org',
              'Origin': SPECS.baseUrl
            },
            body: payload.toString(),
            redirect: 'follow'
          });

          const postHtml = await postRes.text();
          const $result = cheerio.load(postHtml);
          const alertText = $result('script').text();

          if (alertText.includes('Successfully') || postHtml.includes('Successfully') || alertText.includes('Changed')) {
            console.log(`[ChangePwd] ✅ Password changed successfully for ${admissionNumber}`);
            invalidateSession(admissionNumber);
            return corsResponse({ success: true, message: 'Password updated successfully on the college portal!' });
          } else {
            const matches = alertText.match(/alert\(['"]([^'"]+)['"]\)/);
            const errMsg = matches ? matches[1] : 'Portal rejected password change. Check old password.';
            console.warn(`[ChangePwd] ❌ Password change failed for ${admissionNumber}: ${errMsg}`);
            return errorResponse(errMsg, 400);
          }

        } catch (err) {
          console.error(`[ChangePwd] Error: ${err.message}`);
          return errorResponse(`Portal connection failed: ${err.message}`, 502);
        }
      }

      // ── POST /api/auth/encrypt-password ──────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/encrypt-password') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const password = String(body.password || '').trim();
        if (!password) return errorResponse('password is required', 400);

        try {
          const encrypted = await encryptAES(password, env.ENCRYPTION_KEY);
          return corsResponse({ success: true, encrypted });
        } catch (err) {
          return errorResponse(err.message, 500);
        }
      }

      // ── POST /api/auth/decrypt-password ──────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/decrypt-password') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const encrypted = String(body.encrypted || '').trim();
        if (!encrypted) return errorResponse('encrypted is required', 400);

        try {
          const password = await decryptAES(encrypted, env.ENCRYPTION_KEY);
          return corsResponse({ success: true, password });
        } catch (err) {
          return errorResponse(err.message, 500);
        }
      }

      // ── POST /api/auth/verify-profile-data ───────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/verify-profile-data') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const answers = body.answers || {};

        if (!admissionNumber) {
          return errorResponse('admissionNumber is required', 400);
        }

        try {
          const result = await verifyProfileData(admissionNumber, answers, env);
          return corsResponse(result);
        } catch (err) {
          return errorResponse(err.message, 500);
        }
      }

      // ── POST /api/auth/scrape-with-stored-password ───────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/scrape-with-stored-password') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const target = String(body.target || '').trim();

        if (!admissionNumber || !target) {
          return errorResponse('admissionNumber and target are required', 400);
        }

        try {
          const studentDoc = await getStudentDoc(admissionNumber, env);
          if (!studentDoc) return errorResponse('Student profile not found', 404);

          const encryptedPassword = studentDoc.security?.portalPasswordEncrypted;
          if (!encryptedPassword) return errorResponse('No saved password found. Please re-authenticate.', 401);

          const decryptedPassword = await decryptAES(encryptedPassword, env.ENCRYPTION_KEY);

          if (target.toLowerCase() === 'attendance') {
            const runCombinedScrape = async (isRetry = false) => {
              try {
                const cookie = await getSession(admissionNumber, decryptedPassword);
                const subjectWise = await SCRAPERS.attendanceSubjectWise(admissionNumber, cookie, body);
                await new Promise(resolve => setTimeout(resolve, 200));
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
                  invalidateSession(admissionNumber);
                  return runCombinedScrape(true);
                }
                throw err;
              }
            };
            return await runCombinedScrape();
          }

          let targetSection = target.charAt(0).toLowerCase() + target.slice(1);
          if (targetSection === 'feePay') targetSection = 'feePayment';
          if (targetSection === 'feedBack') targetSection = 'feedback';
          if (targetSection === 'internalToUniversity') targetSection = 'internalUniversity';

          const scraperFn = SCRAPERS[targetSection];
          if (!scraperFn) {
            return errorResponse(`Unknown section: ${target}`, 404);
          }

          const scrapeResult = await executeScrape(targetSection, scraperFn, admissionNumber, { ...body, password: decryptedPassword });
          return scrapeResult;
        } catch (err) {
          return errorResponse(err.message, 500);
        }
      }

      // ─── QR Token Routes ────────────────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/auth/generate-qr-token') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const admissionNumber = String(body.admissionNumber || '').trim();
        const deviceToken = String(body.deviceToken || '').trim();
        if (!admissionNumber || !deviceToken) {
          return errorResponse('admissionNumber and deviceToken are required', 400);
        }
        try {
          const result = await generateQrToken(admissionNumber, deviceToken, env);
          return corsResponse(result);
        } catch (err) {
          return errorResponse(err.message, err.message.includes('not found') ? 404 : 403);
        }
      }

      if (request.method === 'POST' && pathname === '/api/auth/verify-qr-token') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const token = String(body.token || '').trim();
        if (!token) {
          return errorResponse('token is required', 400);
        }
        try {
          const result = await verifyQrToken(token, env);
          return corsResponse(result);
        } catch (err) {
          return errorResponse(err.message, 500);
        }
      }

      // ── GET /api/mgu/exam-list ────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/mgu/exam-list') {
        try {
          // In-memory cache (6-hour TTL) — exam list changes rarely
          const cacheKey = 'mgu_exam_list';
          const now = Date.now();
          if (!globalThis._mguExamCache || (now - globalThis._mguExamCacheTs) > 6 * 60 * 60 * 1000) {
            const res = await fetch('https://ugpapi.mgu.ac.in/ugp/api/getActiveExam', {
              headers: { 'Accept': 'application/json', 'User-Agent': 'MacHub/2.0' },
            });
            if (!res.ok) throw new Error(`MGU exam list returned ${res.status}`);
            const data = await res.json();
            const exams = (data.activeexam || []).map(e => ({
              value: String(e.examid),
              label: e.examtitle || '',
              semesterid: e.semesterid || 0,
            }));
            globalThis._mguExamCache = exams;
            globalThis._mguExamCacheTs = now;
          }
          return corsResponse(
            { success: true, exams: globalThis._mguExamCache },
            200,
            { 'Cache-Control': 'public, max-age=21600' }
          );
        } catch (err) {
          console.error('[MGU] Exam list error:', err.message);
          return errorResponse(`Failed to fetch MGU exam list: ${err.message}`, 502);
        }
      }

      // ── GET /api/mgu/captcha ──────────────────────────────────────────────────
      if (request.method === 'GET' && pathname === '/api/mgu/captcha') {
        try {
          const res = await fetch('https://ugpapi.mgu.ac.in/ugp/api/Result/GenerateCaptcha', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'MacHub/2.0' },
          });
          if (!res.ok) throw new Error(`MGU captcha returned ${res.status}`);
          const data = await res.json();
          // cap_img is already a base64 string (no data: prefix from API)
          const imageDataUrl = data.cap_img
            ? (data.cap_img.startsWith('data:') ? data.cap_img : `data:image/png;base64,${data.cap_img}`)
            : null;
          return corsResponse(
            {
              success: true,
              captchaImage: imageDataUrl,
              captchaId: data.captcha_id,
              // IMPORTANT: the MGU API returns the plaintext answer — include it so the frontend
              // can submit without requiring the user to manually solve the captcha.
              captchaAnswer: data.captcha_text || null,
            },
            200,
            { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
          );
        } catch (err) {
          console.error('[MGU] Captcha error:', err.message);
          return errorResponse(`Failed to fetch MGU captcha: ${err.message}`, 502);
        }
      }

      // ── POST /api/mgu/fetch-result ────────────────────────────────────────────
      if (request.method === 'POST' && pathname === '/api/mgu/fetch-result') {
        let body;
        try { body = await request.json(); } catch { body = {}; }
        const prn          = String(body.prn          || '').trim();
        const examId       = String(body.examId       || body.examValue || '').trim();
        const captchaAnswer = String(body.captchaAnswer || '').trim();
        const captchaId    = String(body.captchaId   || body.captchaToken || '').trim();

        if (!prn || !examId || !captchaAnswer || !captchaId) {
          return errorResponse('prn, examId, captchaAnswer, and captchaId are required', 400);
        }

        try {
          const params = new URLSearchParams({
            examid:     examId,
            prn:        prn,
            captcha_in: captchaAnswer,
            captcha_id: captchaId,
          });
          const res = await fetch(
            `https://ugpapi.mgu.ac.in/ugp/api/Result/PublicResultView?${params.toString()}`,
            { headers: { 'Accept': 'application/json', 'User-Agent': 'MacHub/2.0' } }
          );
          const responseText = await res.text();
          let data;
          try { data = JSON.parse(responseText); } catch { data = {}; }

          // Wrong captcha → 422 ERR60
          if (res.status === 422 || data?.status_code === 'ERR60') {
            return corsResponse({ success: false, error: 'CAPTCHA_WRONG' }, 200);
          }

          // No result found → 500 ERR5
          if (res.status === 500 || data?.status_code === 'ERR5') {
            return corsResponse({ success: false, error: 'NO_RESULT_FOUND' }, 200);
          }

          if (!res.ok) {
            return corsResponse({ success: false, error: `MGU_ERROR_${res.status}` }, 200);
          }
          // ── Parse response ──
          const studentDetails = Array.isArray(data.studentDetails) ? data.studentDetails[0] : 
                                 (Array.isArray(data.StudentDetails) ? data.StudentDetails[0] : 
                                 (data.studentDetails || data.StudentDetails || data.studentdetails || data || {}));
          
          const gradeDetails   = data.gradeDetails || data.GradeDetails || data.gradedetails || data || {};
          
          const courseDetails  = Array.isArray(data.courseDetails) ? data.courseDetails :
                                 (Array.isArray(data.CourseDetails) ? data.CourseDetails :
                                 (Array.isArray(data.coursedetails) ? data.coursedetails : 
                                 (Array.isArray(data.courses) ? data.courses : [])));

          const val = (v) => (v !== undefined && v !== null && v !== '') ? String(v) : '';

          const subjects = courseDetails.map(c => ({
            code:            c.course_code    || c.courseCode || c.CourseCode || c.course_Code || '',
            name:            c.course_name    || c.courseName || c.CourseName || c.course_Name || '',
            category:        c.paper_identifier || c.paperIdentifier || c.PaperIdentifier || '',
            theoryInternal:  (c.theory_pract === 'T' || c.theory_pract === 'B') ? val(c.normalised_TI) : '',
            theoryInternalMax:(c.theory_pract === 'T' || c.theory_pract === 'B') ? val(c.normalised_TI_MAX) : '',
            theoryExternal:  (c.theory_pract === 'T' || c.theory_pract === 'B') ? val(c.normalised_TE) : '',
            theoryExternalMax:(c.theory_pract === 'T' || c.theory_pract === 'B') ? val(c.normalised_TE_MAX) : '',
            theoryTotal:     (c.theory_pract === 'T' || c.theory_pract === 'B') ? val(c.T_Total) : '',
            practInternal:   (c.theory_pract === 'P' || c.theory_pract === 'B') ? val(c.normalised_PI) : '',
            practInternalMax:(c.theory_pract === 'P' || c.theory_pract === 'B') ? val(c.normalised_PI_MAX) : '',
            practExternal:   (c.theory_pract === 'P' || c.theory_pract === 'B') ? val(c.normalised_PE) : '',
            practExternalMax:(c.theory_pract === 'P' || c.theory_pract === 'B') ? val(c.normalised_PE_MAX) : '',
            practTotal:      (c.theory_pract === 'P' || c.theory_pract === 'B') ? val(c.P_Total) : '',
            totalMark:       val(c.Total_Mark || c.totalMark || c.TotalMark),
            totalMarkMax:    val(c.Total_Mark_Max || c.totalMarkMax || c.TotalMarkMax),
            grade:           c.grade          || c.Grade || '',
            gradePoints:     val(c.GP || c.gp || c.GradePoint),
            credits:         val(c.theory_credit || c.theoryCredit || c.theory_Credit),
            totalCredits:    val(c.total_credit || c.totalCredit || c.total_Credit),
            acquiredCredits: val(c.acquired_credit || c.acquiredCredit || c.acquired_Credit),
            creditPoint:     val(c.credit_point || c.creditPoint || c.credit_Point),
            result:          c.result         || c.Result || '',
            type:            c.theory_pract   || c.theoryPract || c.theory_pract || '',
          }));

          const studentName = studentDetails.studentname || studentDetails.student_name || studentDetails.studentName || studentDetails.StudentName ||
                              studentDetails.name || studentDetails.Name || studentDetails.Student_Name || 
                              data.studentname || data.student_name || data.studentName || data.name || '';
          
          const studentPrn = studentDetails.PRN || studentDetails.prn || studentDetails.registerNumber || prn;
          const regNo = studentDetails.register_no || studentDetails.registerNo || studentDetails.RegisterNo ||
                        studentDetails.reg_no || studentDetails.regNo || studentDetails.RegNo || 
                        studentDetails.PRN || studentDetails.prn || '';
          
          const semMatch = (studentDetails.examtitle || data.examtitle || '').match(/(\w+)\s+Semester/i);
          const sem = studentDetails.semester || studentDetails.Semester || data.semester || (semMatch ? semMatch[1] : '');
          
          const college = studentDetails.college_name || studentDetails.collegeName || studentDetails.CollegeName ||
                          studentDetails.college || studentDetails.College ||
                          data.college_name || data.collegeName || '';
          const programme = studentDetails.programme_name || studentDetails.programmeName || studentDetails.ProgrammeName ||
                            studentDetails.course_name || studentDetails.courseName || studentDetails.programme ||
                            data.programme_name || data.programmeName || '';

          const result = {
            studentName,
            prn:            studentPrn,
            registerNumber: regNo,
            examName:       '',  // filled by caller from exam list
            semester:       sem,
            college,
            programme,
            subjects,
            sgpa:           String(gradeDetails.sgpa || gradeDetails.SGPA || gradeDetails.Sgpa || ''),
            cgpa:           String(gradeDetails.cgpa || gradeDetails.CGPA || gradeDetails.Cgpa || ''),
            overallResult:  gradeDetails.concatenated_result || gradeDetails.concatenatedResult || 
                            gradeDetails.result || gradeDetails.overallResult || '',
            declaredDate:   '',
          };

          return corsResponse({ success: true, result }, 200);
        } catch (err) {
          console.error('[MGU] Fetch result error:', err.message);
          return errorResponse(`Failed to fetch MGU result: ${err.message}`, 502);
        }
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
