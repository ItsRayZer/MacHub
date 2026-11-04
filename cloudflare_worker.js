/**
 * Machin On-Demand Refresh Trigger (hardened)
 * Deploy this as a FREE Cloudflare Worker.
 *
 * What it does:
 *   - App calls POST /refresh with { admission_no }
 *   - This Worker triggers GitHub Actions for THAT student only
 *   - GitHub Actions scrapes and pushes data to Firebase (~20s)
 *   - App's Firebase listener fires → UI updates automatically
 *
 * Hardening (Nov 2026):
 *   - Optional shared secret: set WORKER_SECRET env var, then callers must
 *     send it as the `x-machub-key` header. (Client-side secret = friction
 *     against drive-by abuse, not true auth.)
 *   - Origin allowlist: set APP_ORIGINS env var (comma-separated). Default "*".
 *   - admission_no format validation before touching the GitHub API.
 *
 * Zero cost:
 *   - Cloudflare Workers: 100,000 requests/day FREE
 *   - GitHub Actions: each single-student run ~15 min FREE (2,000/month free)
 */

export default {
  async fetch(request, env) {
    // ── CORS headers ──────────────────────────────────────────────────────
    const allowedOrigins = (env.APP_ORIGINS || '*')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const reqOrigin = request.headers.get('Origin') || '';
    const allowOrigin = allowedOrigins.includes('*')
      ? '*'
      : (allowedOrigins.includes(reqOrigin) ? reqOrigin : 'null');

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-machub-key",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST /refresh only" }),
        { status: 405, headers: corsHeaders }
      );
    }

    // ── Shared-secret check (only enforced when WORKER_SECRET is set) ─────
    if (env.WORKER_SECRET) {
      const key = request.headers.get('x-machub-key') || '';
      // Constant-time-ish compare to avoid trivial timing leaks
      let ok = key.length === env.WORKER_SECRET.length;
      for (let i = 0; i < Math.max(key.length, env.WORKER_SECRET.length); i++) {
        if (key[i] !== env.WORKER_SECRET[i]) ok = false;
      }
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // ── Parse + validate request ──────────────────────────────────────────
    let admission_no, password;
    try {
      const body = await request.json();
      admission_no = String(body.admission_no || "").trim();
      password = String(body.password || admission_no).trim(); // BCA: pwd = adm_no
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Admission numbers are numeric, 3-8 digits. Reject anything else before
    // it can reach the GitHub API.
    if (!/^\d{3,8}$/.test(admission_no)) {
      return new Response(
        JSON.stringify({ error: "admission_no must be a 3-8 digit number" }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (password.length > 64) {
      return new Response(
        JSON.stringify({ error: "password too long" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Trigger GitHub Actions via repository_dispatch ────────────────────

    const githubApiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;

    const ghResponse = await fetch(githubApiUrl, {
      method: "POST",
      headers: {
        Authorization: `token ${env.GITHUB_PAT}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "MachinApp/1.0",
      },
      body: JSON.stringify({
        event_type: "scrape_student",
        client_payload: { admission_no, password },
      }),
    });

    if (ghResponse.status === 204) {
      // 204 = success (GitHub returns no body on success)
      return new Response(
        JSON.stringify({
          success: true,
          message: "Refresh started. Data will update in ~20-30 seconds.",
          admission_no,
        }),
        { headers: corsHeaders }
      );
    } else {
      const errText = await ghResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `GitHub API error ${ghResponse.status}: ${errText}`,
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
