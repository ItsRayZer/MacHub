import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function testFetch() {
  const cookie = '.ASPXAUTH=...'; // Will get real cookie via auth endpoint
  
  // First login via local proxy to get a fresh cookie
  const loginRes = await fetch('http://127.0.0.1:8787/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionNumber: '12965', password: '12965' })
  });
  const loginData = await loginRes.json();
  const realCookie = loginData.cookie || loginData.sessionCookie || loginData.data?.cookie;
  if (!realCookie) {
    console.log('Login failed', loginData);
    return;
  }
  
  console.log('Got cookie:', realCookie.substring(0, 30) + '...');
  
  // Now POST directly to portal using the logic from scraper.js
  const PORTAL_BASE = "https://eportal.maraugusthinosecollege.org";
  const url = "/ExamResult.aspx";
  const requestHeaders = {
    "Cookie": realCookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Host": "eportal.maraugusthinosecollege.org",
    "Referer": PORTAL_BASE + "/Dashboard.aspx"
  };

  const getRes = await fetch(PORTAL_BASE + url, { method: "GET", headers: requestHeaders });
  const html = await getRes.text();
  const $ = cheerio.load(html);
  
  const payload = {};
  $('input').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).val();
    if (name) payload[name] = val || '';
  });
  
  payload['ctl00$MainContent$ddlsem'] = '2';
  payload['__EVENTTARGET'] = 'ctl00$MainContent$ddlsem';
  payload['__EVENTARGUMENT'] = '';
  
  const bodyParams = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) bodyParams.append(k, v);
  
  const postHeaders = { ...requestHeaders, "Content-Type": "application/x-www-form-urlencoded" };
  const postRes = await fetch(PORTAL_BASE + url, { method: "POST", headers: postHeaders, body: bodyParams.toString() });
  
  const postHtml = await postRes.text();
  fs.writeFileSync('examresult_post_debug.html', postHtml);
  console.log('Saved post html to examresult_post_debug.html, length:', postHtml.length);
}

testFetch();
