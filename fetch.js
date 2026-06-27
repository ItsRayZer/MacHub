const fs = require('fs');

async function fetchProfile() {
  const loginRes = await fetch('https://eportal.maraugusthinosecollege.org/Default.aspx?ReturnUrl=%2f');
  const loginHtml = await loginRes.text();
  const vs = loginHtml.match(/id="__VIEWSTATE" value="([^"]+)"/)[1];
  const vsg = loginHtml.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/)[1];
  const ev = loginHtml.match(/id="__EVENTVALIDATION" value="([^"]+)"/)[1];
  
  const params = new URLSearchParams();
  params.append('__VIEWSTATE', vs);
  params.append('__VIEWSTATEGENERATOR', vsg);
  params.append('__EVENTVALIDATION', ev);
  params.append('txtUser', '12965');
  params.append('txtPassword', '12965');
  params.append('btnLogin', 'Sign In');
  
  const authRes = await fetch('https://eportal.maraugusthinosecollege.org/Default.aspx?ReturnUrl=%2f', {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual'
  });
  
  const cookie = authRes.headers.get('set-cookie').split(';')[0];
  
  const profileRes = await fetch('https://eportal.maraugusthinosecollege.org/Profile.aspx', {
    headers: { 'Cookie': cookie }
  });
  const profileHtml = await profileRes.text();
  fs.writeFileSync('C:\\Users\\abens\\.gemini\\antigravity\\worktrees\\MacHub\\machin-scraper-backend-engine\\profile_raw.html', profileHtml);
  console.log('Saved profile_raw.html');
}

fetchProfile();
