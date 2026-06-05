/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Auth Module — Portal Session Manager                    ║
 * ║   Handles login, cookie capture, session caching (25min TTL)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import * as cheerio from 'cheerio';
import { SPECS } from './specs.js';

// In-memory session store — lives for the Worker's lifetime
const sessionStore = new Map();
const SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutes

const BASE_URL = SPECS.baseUrl;
const LOGIN_PATH = SPECS.loginPage;

/** Standard browser-like headers for all requests */
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
};

/**
 * Extract all Set-Cookie headers into a single cookie string.
 * Only takes key=value before the first semicolon.
 */
function extractCookies(response) {
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) return '';

  // Cloudflare Workers provides set-cookie as a single string (comma-separated)
  // We need to split properly — cookies can contain commas in date values
  const cookies = {};

  // Use getAll if available (newer Workers runtime)
  let rawCookies = [];
  if (typeof response.headers.getAll === 'function') {
    rawCookies = response.headers.getAll('set-cookie');
  } else {
    // Parse from a single header — split on ", " only before cookie name=
    rawCookies = setCookieHeader.split(/,(?=[^;]+=[^;]+(?:;|$))/g);
  }

  for (const raw of rawCookies) {
    const keyVal = raw.split(';')[0].trim();
    const eqIdx = keyVal.indexOf('=');
    if (eqIdx < 0) continue;
    const name = keyVal.substring(0, eqIdx).trim();
    const value = keyVal.substring(eqIdx + 1).trim();
    if (name) cookies[name] = value;
  }

  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Extract ASP.NET hidden tokens from login page HTML.
 */
function extractTokens(html) {
  const $ = cheerio.load(html);
  return {
    __VIEWSTATE: $('[name="__VIEWSTATE"]').val() || $('[id="__VIEWSTATE"]').val() || '',
    __VIEWSTATEGENERATOR: $('[name="__VIEWSTATEGENERATOR"]').val() || $('[id="__VIEWSTATEGENERATOR"]').val() || '',
    __EVENTVALIDATION: $('[name="__EVENTVALIDATION"]').val() || $('[id="__EVENTVALIDATION"]').val() || '',
    usernameField: $('input[type="text"]').first().attr('name') || SPECS.formFields.username,
    passwordField: $('input[type="password"]').first().attr('name') || SPECS.formFields.password,
    submitField: $('input[type="submit"]').first().attr('name') || SPECS.formFields.submitButton,
    submitValue: $('input[type="submit"]').first().attr('value') || SPECS.formFields.submitValue,
  };
}

/**
 * Detect if an HTML response is actually a login page (session expired).
 */
export function isLoginPage(html) {
  if (!html || typeof html !== 'string') return true;
  const lower = html.toLowerCase();
  return (
    (lower.includes('txtusername') || lower.includes('txtpassword')) &&
    lower.includes('id="submit"')
  );
}

/**
 * Core session acquisition function.
 * Returns valid cookie string for the given admission number.
 * Uses in-memory cache, re-authenticates only when expired.
 */
export async function getSession(admissionNumber) {
  const now = Date.now();
  const cached = sessionStore.get(admissionNumber);

  // Return cached session if still valid
  if (cached && cached.expiresAt > now) {
    console.log(`[Auth] Cache hit for ${admissionNumber}`);
    return cached.cookie;
  }

  console.log(`[Auth] Login handshake for ${admissionNumber}...`);

  // ── Step 1: GET login page to extract ASP.NET tokens ─────────────────────
  const loginUrl = `${BASE_URL}${LOGIN_PATH}`;
  const landingRes = await fetch(loginUrl, {
    method: 'GET',
    headers: {
      ...BROWSER_HEADERS,
      'Host': 'eportal.maraugusthinosecollege.org',
    },
    redirect: 'follow',
  });

  if (!landingRes.ok) {
    throw new Error(`Portal login page returned HTTP ${landingRes.status}`);
  }

  const landingHtml = await landingRes.text();
  const landingCookies = extractCookies(landingRes);
  const tokens = extractTokens(landingHtml);

  console.log(`[Auth] Tokens extracted. Username field: "${tokens.usernameField}"`);

  // ── Step 2: Build POST body ───────────────────────────────────────────────
  const postBody = new URLSearchParams({
    [tokens.usernameField]: admissionNumber,
    [tokens.passwordField]: admissionNumber, // admission no = password
    [tokens.submitField]: tokens.submitValue,
    '__VIEWSTATE': tokens.__VIEWSTATE,
    '__VIEWSTATEGENERATOR': tokens.__VIEWSTATEGENERATOR,
    '__EVENTVALIDATION': tokens.__EVENTVALIDATION,
  });

  // ── Step 3: POST credentials ──────────────────────────────────────────────
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Host': 'eportal.maraugusthinosecollege.org',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}${LOGIN_PATH}?ReturnUrl=%2f`,
      ...(landingCookies ? { 'Cookie': landingCookies } : {}),
    },
    body: postBody.toString(),
    redirect: 'manual', // Capture 302 redirect manually
  });

  // ── Step 4: Extract session cookie ───────────────────────────────────────
  let sessionCookie = '';

  if (loginRes.status === 302) {
    // Success: portal redirects to dashboard
    const postCookies = extractCookies(loginRes);
    sessionCookie = [landingCookies, postCookies].filter(Boolean).join('; ');

    // If no session cookie in the 302, use landing cookies
    if (!sessionCookie.includes('ASP.NET_SessionId') && !sessionCookie.includes('.ASPXAUTH')) {
      console.warn('[Auth] No ASP.NET session cookie in 302, trying landing cookies only');
      sessionCookie = landingCookies;
    }
  } else if (loginRes.status === 200) {
    // Some configurations return 200 with cookies even on success
    const body = await loginRes.text();
    if (isLoginPage(body)) {
      throw new Error('LOGIN_FAILED: Invalid admission number or portal rejected login');
    }
    const postCookies = extractCookies(loginRes);
    sessionCookie = [landingCookies, postCookies].filter(Boolean).join('; ');
  } else {
    throw new Error(`LOGIN_FAILED: Expected 302, got ${loginRes.status}`);
  }

  if (!sessionCookie) {
    throw new Error('LOGIN_FAILED: No session cookie captured');
  }

  // ── Step 5: Verify login by fetching dashboard ────────────────────────────
  try {
    const verifyRes = await fetch(`${BASE_URL}/Dashboard.aspx`, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Host': 'eportal.maraugusthinosecollege.org',
        'Cookie': sessionCookie,
        'Referer': loginUrl,
      },
      redirect: 'follow',
    });

    const verifyHtml = await verifyRes.text();
    if (isLoginPage(verifyHtml)) {
      throw new Error('LOGIN_FAILED: Dashboard redirected back to login');
    }
  } catch (verifyErr) {
    if (verifyErr.message.startsWith('LOGIN_FAILED')) throw verifyErr;
    // Non-fatal: network error during verify, proceed anyway
    console.warn(`[Auth] Verify step failed (non-fatal): ${verifyErr.message}`);
  }

  // ── Step 6: Cache session ─────────────────────────────────────────────────
  sessionStore.set(admissionNumber, {
    cookie: sessionCookie,
    expiresAt: now + SESSION_TTL_MS,
  });

  console.log(`[Auth] ✅ Login OK for ${admissionNumber}`);
  return sessionCookie;
}

/**
 * Invalidate cached session for a given admission number.
 */
export function invalidateSession(admissionNumber) {
  sessionStore.delete(admissionNumber);
  console.log(`[Auth] Session invalidated for ${admissionNumber}`);
}

/**
 * Import PEM PKCS#8 private key for RS256 signing.
 */
async function importPrivateKey(pem) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  const startIdx = pem.indexOf(pemHeader);
  const endIdx = pem.indexOf(pemFooter);
  
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Invalid private key format: Missing BEGIN/END headers");
  }
  
  const pemContents = pem
    .substring(startIdx + pemHeader.length, endIdx)
    .replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );
}

/**
 * Base64 URL Safe encoding helper.
 */
function base64url(bufferOrString) {
  let str = "";
  if (typeof bufferOrString === 'string') {
    str = btoa(unescape(encodeURIComponent(bufferOrString)));
  } else {
    const bytes = new Uint8Array(bufferOrString);
    for (let i = 0; i < bytes.byteLength; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    str = btoa(str);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Mint a Firebase Custom Auth Token signed using Web Cryptography API.
 */
export async function mintCustomToken(admissionNumber, env) {
  if (!env || !env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment secret");
  }

  let privateKeyPem = "";
  let clientEmail = "";
  
  const keySecret = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
  if (keySecret.startsWith("{")) {
    const sa = JSON.parse(keySecret);
    privateKeyPem = sa.private_key;
    clientEmail = sa.client_email;
  } else {
    privateKeyPem = keySecret;
    clientEmail = "firebase-adminsdk@placeholder.iam.gserviceaccount.com";
  }

  const key = await importPrivateKey(privateKeyPem);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid: `student_${admissionNumber}`,
    claims: {
      admissionNumber: admissionNumber
    }
  };

  const tokenInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(tokenInput)
  );

  return `${tokenInput}.${base64url(signature)}`;
}
