/**
 * Machin On-Demand Refresh Trigger
 * Deploy this as a FREE Cloudflare Worker.
 *
 * What it does:
 *   - App calls POST /refresh with { admission_no }
 *   - This Worker triggers GitHub Actions for THAT student only
 *   - GitHub Actions scrapes and pushes data to Firebase (~20s)
 *   - App's Firebase listener fires → UI updates automatically
 *
 * Zero cost:
 *   - Cloudflare Workers: 100,000 requests/day FREE
 *   - GitHub Actions: each single-student run ~15 min FREE (2,000/month free)
 */

export default {
  async fetch(request, env) {
    // ── CORS headers (allow your app domain) ────────────────────────────────
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
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

    // ── Parse request ────────────────────────────────────────────────────────
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

    if (!admission_no) {
      return new Response(
        JSON.stringify({ error: "admission_no is required" }),
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
