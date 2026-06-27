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
export async function getSession(admissionNumber, customPassword) {
  const password = String(customPassword || admissionNumber).trim();
  const now = Date.now();
  const cacheKey = `${admissionNumber}:${password}`;
  const cached = sessionStore.get(cacheKey);

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
    [tokens.passwordField]: password,
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
  sessionStore.set(cacheKey, {
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
  for (const key of sessionStore.keys()) {
    if (key.startsWith(`${admissionNumber}:`)) {
      sessionStore.delete(key);
    }
  }
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

export async function verifyFirebaseIdToken(idToken, env) {
  if (!idToken) return null;
  const apiKey = env.FIREBASE_API_KEY || 'AIzaSyCfRvyKJdTkMHqNHJfsVd2g-hwnTjcXvL8';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data.users?.[0]?.localId || null;
  } catch (err) {
    console.error('[Worker Auth] ID Token verification failed:', err.message);
    return null;
  }
}

// ─── AES Encryption Helpers ──────────────────────────────────────────────────
async function getEncryptionKey(keyHex) {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptAES(plaintext, keyHex) {
  const key = await getEncryptionKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}:${cipherHex}`;
}

export async function decryptAES(encryptedStr, keyHex) {
  const key = await getEncryptionKey(keyHex);
  const parts = encryptedStr.split(':');
  if (parts.length !== 2) throw new Error("Invalid encrypted string format");
  
  const ivBytes = new Uint8Array(parts[0].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const cipherBytes = new Uint8Array(parts[1].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    cipherBytes
  );
  
  return new TextDecoder().decode(decrypted);
}

// ─── Firestore REST Client Helpers ──────────────────────────────────────────
let oauthTokenCache = null;

async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (oauthTokenCache && oauthTokenCache.expiresAt > now + 60000) {
    return oauthTokenCache.token;
  }

  const keySecret = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
  let sa;
  try {
    sa = JSON.parse(keySecret);
  } catch (e) {
    throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON");
  }

  const privateKeyPem = sa.private_key;
  const clientEmail = sa.client_email;
  const key = await importPrivateKey(privateKeyPem);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp
  };

  const tokenInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(tokenInput)
  );

  const assertion = `${tokenInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  oauthTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000)
  };

  return data.access_token;
}

function fromFirestoreVal(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreVal(v);
    }
    return obj;
  }
  if ('arrayValue' in val) {
    const arr = val.arrayValue.values || [];
    return arr.map(v => fromFirestoreVal(v));
  }
  return undefined;
}

function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    obj[k] = fromFirestoreVal(v);
  }
  return obj;
}

function toFirestoreVal(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(val)) {
      return { timestampValue: val };
    }
    return { stringValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(v => toFirestoreVal(v)) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreVal(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreVal(v);
  }
  return fields;
}

export async function getStudentDoc(admissionNumber, env) {
  const token = await getGoogleAccessToken(env);
  const keySecret = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
  const sa = JSON.parse(keySecret);
  const projectId = sa.project_id;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/students/${admissionNumber}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch student doc: ${res.status} ${text}`);
  }

  const doc = await res.json();
  return fromFirestoreDoc(doc);
}

export async function updateStudentDoc(admissionNumber, fieldsToUpdate, env) {
  const token = await getGoogleAccessToken(env);
  const keySecret = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
  const sa = JSON.parse(keySecret);
  const projectId = sa.project_id;

  const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/students/${admissionNumber}`);
  
  for (const key of Object.keys(fieldsToUpdate)) {
    url.searchParams.append('updateMask.fieldPaths', key);
  }

  const fields = toFirestoreFields(fieldsToUpdate);

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update student doc: ${res.status} ${text}`);
  }

  const doc = await res.json();
  return fromFirestoreDoc(doc);
}

// Helper to check identity verification answers
function checkAnswer(scrapedVal, userVal, type) {
  if (!scrapedVal) return false;
  const scrapedStr = String(scrapedVal).trim();
  const userStr = String(userVal).trim();

  if (type === 'dob') {
    const parseDate = (str) => {
      let m = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
      if (m) return { day: parseInt(m[1], 10), month: parseInt(m[2], 10), year: parseInt(m[3], 10) };
      m = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
      if (m) return { day: parseInt(m[3], 10), month: parseInt(m[2], 10), year: parseInt(m[1], 10) };
      return null;
    };
    const sDate = parseDate(scrapedStr);
    const uDate = parseDate(userStr);
    if (!sDate || !uDate) return false;
    return sDate.day === uDate.day && sDate.month === uDate.month && sDate.year === uDate.year;
  }

  if (type === 'phone') {
    const cleanS = scrapedStr.replace(/\D/g, '').slice(-10);
    const cleanU = userStr.replace(/\D/g, '').slice(-10);
    return cleanS === cleanU && cleanU.length === 10;
  }

  if (type === 'phoneLast4') {
    const cleanS = scrapedStr.replace(/\D/g, '').slice(-4);
    const cleanU = userStr.replace(/\D/g, '').slice(-4);
    return cleanS === cleanU && cleanU.length === 4;
  }

  if (type === 'aadhaarLast4') {
    const cleanS = scrapedStr.replace(/\D/g, '').slice(-4);
    const cleanU = userStr.replace(/\D/g, '').slice(-4);
    return cleanS === cleanU && cleanU.length === 4;
  }

  if (type === 'fatherName' || type === 'motherName' || type === 'email') {
    return scrapedStr.toLowerCase() === userStr.toLowerCase();
  }

  if (type === 'parentPhone') {
    const cleanS = scrapedStr.replace(/\D/g, '').slice(-10);
    const cleanU = userStr.replace(/\D/g, '').slice(-10);
    return cleanS === cleanU && cleanU.length === 10;
  }

  if (type === 'bloodGroup') {
    return scrapedStr === userStr;
  }

  if (type === 'pincode') {
    const sPincodeMatch = scrapedStr.match(/\b\d{6}\b/);
    if (!sPincodeMatch) return false;
    const cleanU = userStr.replace(/\D/g, '');
    return sPincodeMatch[0] === cleanU && cleanU.length === 6;
  }

  return false;
}

export async function verifyProfileData(admissionNumber, answers, env) {
  const studentDoc = await getStudentDoc(admissionNumber, env);
  if (!studentDoc) {
    throw new Error("Student document not found");
  }

  const security = studentDoc.security || {};
  const lockTime = security.verificationLockedUntil;
  if (lockTime) {
    const lockDate = new Date(lockTime);
    if (lockDate.getTime() > Date.now()) {
      return { success: false, error: 'LOCKED', lockedUntil: lockTime };
    }
  }

  const profile = studentDoc.profile || {};
  const profileData = profile.data || {};

  let allMatch = true;
  const wrongQuestions = [];
  const questionKeys = Object.keys(answers);

  for (let i = 0; i < questionKeys.length; i++) {
    const key = questionKeys[i];
    const userVal = answers[key];
    let scrapedVal = '';
    let type = key;

    if (key === 'dob') {
      scrapedVal = profileData.dob;
    } else if (key === 'phone') {
      scrapedVal = profileData.phone;
    } else if (key === 'phoneLast4') {
      scrapedVal = profileData.phone;
    } else if (key === 'aadhaarLast4') {
      scrapedVal = profileData.aadhar || profileData.aadhaar;
    } else if (key === 'fatherName') {
      scrapedVal = profileData.fatherName || profileData.guardianName;
    } else if (key === 'motherName') {
      scrapedVal = profileData.motherName;
    } else if (key === 'parentPhone') {
      scrapedVal = profileData.parentPhone || profileData.guardianPhone;
    } else if (key === 'email') {
      scrapedVal = profileData.email;
    } else if (key === 'bloodGroup') {
      scrapedVal = profileData.bloodGroup || profileData.blood_group;
    } else if (key === 'pincode') {
      scrapedVal = profileData.address || profileData.permanentAddress;
    }

    const match = checkAnswer(scrapedVal, userVal, type);
    if (!match) {
      allMatch = false;
      wrongQuestions.push(key);
    }
  }

  const updates = { ...security };
  if (allMatch) {
    updates.verificationAttempts = 0;
    updates.verificationLockedUntil = null;
    await updateStudentDoc(admissionNumber, { security: updates }, env);
    return { success: true, verified: true };
  } else {
    const attempts = (security.verificationAttempts || 0) + 1;
    updates.verificationAttempts = attempts;
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      updates.verificationLockedUntil = lockUntil;
    }
    await updateStudentDoc(admissionNumber, { security: updates }, env);
    return { 
      success: false, 
      error: 'VERIFICATION_FAILED', 
      attemptsRemaining: Math.max(0, 5 - attempts),
      wrongQuestions
    };
  }
}

// ─── QR Token Helpers ───────────────────────────────────────────────────────────

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  return bytes.buffer;
}

/**
 * Generate a short-lived HMAC-SHA256 JWT for QR code display.
 * Token lifetime: 30 seconds.
 */
export async function generateQrToken(admissionNumber, deviceToken, env) {
  const studentDoc = await getStudentDoc(admissionNumber, env);
  if (!studentDoc) throw new Error('Student not found');
  if (studentDoc.status !== 'active') throw new Error('Student profile is not active');

  const deviceTokens = studentDoc.security?.deviceTokens || [];
  if (!deviceTokens.includes(deviceToken)) throw new Error('Invalid device token');

  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ sub: admissionNumber, iat: now, exp: now + 30 }));

  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(env.ENCRYPTION_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`));

  return {
    success: true,
    token: `${header}.${payload}.${base64url(signature)}`,
    expiresIn: 30
  };
}

/**
 * Verify an HMAC-SHA256 QR token and return student info if valid.
 */
export async function verifyQrToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'invalid' };

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(env.ENCRYPTION_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode the base64url signature back to a buffer
  const sigStr = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
  const sigBuffer = new Uint8Array(sigStr.length);
  for (let i = 0; i < sigStr.length; i++) sigBuffer[i] = sigStr.charCodeAt(i);

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBuffer,
    encoder.encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) return { valid: false, reason: 'invalid' };

  // Decode payload
  const payloadJson = decodeURIComponent(escape(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))));
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { valid: false, reason: 'expired' };

  const studentDoc = await getStudentDoc(payload.sub, env);
  if (!studentDoc) return { valid: false, reason: 'not_found' };
  if (studentDoc.status !== 'active') return { valid: false, reason: 'inactive' };

  const name = studentDoc.profile?.data?.name || null;
  const course = studentDoc.profile?.data?.course || null;
  const division = studentDoc.profile?.data?.division || null;

  return {
    valid: true,
    student: {
      admissionNumber: payload.sub,
      name,
      course,
      division
    }
  };
}
