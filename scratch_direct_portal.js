const fs = require('fs');
const axios = require('axios');
const qs = require('querystring');
const cheerio = require('cheerio');

async function getExamResults() {
  const portalAgent = axios.create({
    withCredentials: true,
    maxRedirects: 0,
    validateStatus: () => true
  });

  const baseUrl = 'https://eportal.maraugusthinosecollege.org';
  
  // 1. Get initial cookie
  const initRes = await portalAgent.get(`${baseUrl}/`);
  let cookie = initRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
  
  // 2. Login
  const loginHtml = initRes.data;
  const $ = cheerio.load(loginHtml);
  const payload = {};
  $('input').each((_, el) => {
    if ($(el).attr('name')) payload[$(el).attr('name')] = $(el).val() || '';
  });
  payload['txtUser'] = '12965';
  payload['txtPassword'] = '12965';
  payload['btnLogin'] = 'Login';
  
  const loginRes = await portalAgent.post(`${baseUrl}/Default.aspx`, qs.stringify(payload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie }
  });
  
  if (loginRes.headers['set-cookie']) {
    cookie = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  }
  
  // 3. GET Exam Result page
  const examGetRes = await portalAgent.get(`${baseUrl}/ExamResult.aspx`, {
    headers: { 'Cookie': cookie }
  });
  
  const $exam = cheerio.load(examGetRes.data);
  const examPayload = {};
  $exam('input, select').each((_, el) => {
    if ($exam(el).attr('name')) examPayload[$exam(el).attr('name')] = $exam(el).val() || '';
  });
  
  examPayload['ctl00$MainContent$ddlsem'] = '2';
  examPayload['__EVENTTARGET'] = 'ctl00$MainContent$ddlsem';
  examPayload['__EVENTARGUMENT'] = '';
  delete examPayload['ctl00$MainContent$btnSubmit'];
  
  // 4. POST Exam Result page
  const examPostRes = await portalAgent.post(`${baseUrl}/ExamResult.aspx`, qs.stringify(examPayload), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie }
  });
  
  const postHtml = examPostRes.data;
  fs.writeFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\exam_result_final.html', postHtml);
  console.log('Saved to exam_result_final.html. Length:', postHtml.length);
  
  const $post = cheerio.load(postHtml);
  console.log('Tables found:', $post('table').length);
}

getExamResults();
