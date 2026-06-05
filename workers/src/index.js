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
        await getSession(admissionNumber);

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
        const cookie = await getSession(admissionNumber);
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
        const cookie = await getSession(admissionNumber);
        // Scrape the sub-page using scrapePage helper
        const parsed = await scrapePage('StudyMaterialDetail', path, cookie);
        return corsResponse({
          success: true,
          data: parsed.data,
          page: 'StudyMaterialDetail',
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        return errorResponse(err.message || 'Failed to fetch details', 500);
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

      // Validate section
      const scraperFn = SCRAPERS[section];
      if (!scraperFn) {
        return errorResponse(`Unknown section: ${section}. Valid sections: ${Object.keys(SCRAPERS).join(', ')}`, 404);
      }

      // Execute with automatic session retry
      const result = await executeScrape(section, scraperFn, admissionNumber, body);
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
  },
};

/**
 * Execute a scrape with automatic session retry on SESSION_EXPIRED.
 */
async function executeScrape(section, scraperFn, admissionNumber, body = {}, isRetry = false) {
  try {
    const cookie = await getSession(admissionNumber);
    const data = await scraperFn(admissionNumber, cookie, body);

    return corsResponse({
      success: true,
      section,
      admissionNumber,
      data: data.data,
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
