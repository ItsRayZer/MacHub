/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MacHub Scraper Module — Per-page scraper functions             ║
 * ║   Each function: fetches the portal page, detects session        ║
 * ║   expiry, and passes HTML to the parser module.                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import * as cheerio from 'cheerio';
import { parseHtml } from './parser.js';
import { isLoginPage } from './auth.js';
import { SPECS } from './specs.js';

const BASE_URL = SPECS.baseUrl;

/** Standard portal headers for all page requests */
const PORTAL_HEADERS = (cookie) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Referer': `${BASE_URL}/Dashboard.aspx`,
  'Host': 'eportal.maraugusthinosecollege.org',
  'Cookie': cookie,
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
});

/**
 * Generic page scraper — fetches and parses a page.
 * Throws 'SESSION_EXPIRED' if the response is a login page.
 * Throws 'PAGE_NOT_FOUND' for 404.
 * Throws 'PORTAL_ERROR' for other server errors.
 */
export async function scrapePage(pageName, path, cookie) {
  const url = `${BASE_URL}${path}`;
  console.log(`[Scraper] Fetching ${pageName}: ${url}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: PORTAL_HEADERS(cookie),
    redirect: 'manual',
  });

  // Session expiry detection: 302 redirect to login
  if (res.status === 302) {
    const loc = res.headers.get('location') || '';
    if (loc.toLowerCase().includes('login') || loc.toLowerCase().includes('default.aspx')) {
      throw new Error('SESSION_EXPIRED');
    }
    // Follow redirect manually
    const redirectRes = await fetch(
      loc.startsWith('http') ? loc : `${BASE_URL}${loc}`,
      { method: 'GET', headers: PORTAL_HEADERS(cookie), redirect: 'follow' }
    );
    const redirectHtml = await redirectRes.text();
    if (isLoginPage(redirectHtml)) throw new Error('SESSION_EXPIRED');
    return parseHtml(pageName, redirectHtml);
  }

  if (res.status === 404) {
    throw new Error(`PAGE_NOT_FOUND: ${path}`);
  }

  if (res.status >= 500) {
    throw new Error(`PORTAL_ERROR: HTTP ${res.status} on ${path}`);
  }

  const html = await res.text();

  // Session expiry detection: login page served as 200
  if (isLoginPage(html)) {
    throw new Error('SESSION_EXPIRED');
  }

  return parseHtml(pageName, html);
}

// ═══════════════════════════════════════════════════════════════
//  PER-SECTION SCRAPERS
// ═══════════════════════════════════════════════════════════════

export const scrapeProfile = (adm, cookie) =>
  scrapePage('Profile', SPECS.sectionEndpoints.Profile, cookie);

export const scrapeDashboard = (adm, cookie) =>
  scrapePage('Dashboard', SPECS.sectionEndpoints.Dashboard, cookie);

export const scrapeStudyMaterial = (adm, cookie) =>
  scrapePage('StudyMaterial', SPECS.sectionEndpoints.StudyMaterial, cookie);

export const scrapeAssessment = (adm, cookie) =>
  scrapePage('Assessment', SPECS.sectionEndpoints.Assessment, cookie);

export const scrapeAssignment = (adm, cookie) =>
  scrapePage('Assignment', SPECS.sectionEndpoints.Assignment, cookie);

export const scrapeSeminar = (adm, cookie) =>
  scrapePage('Seminar', SPECS.sectionEndpoints.Seminar, cookie);

export const scrapeAttendance = async (adm, cookie, body) => {
  if (body && body.semester) {
    console.log(`[Scraper] Fetching Attendance for semester ${body.semester}`);
    
    // GET AttendanceNew.aspx to extract tokens and hidden fields
    const getRes = await fetch(`${BASE_URL}${SPECS.sectionEndpoints.Attendance}`, {
      method: 'GET',
      headers: PORTAL_HEADERS(cookie),
      redirect: 'manual'
    });
    
    if (getRes.status === 302) {
      throw new Error('SESSION_EXPIRED');
    }
    
    const getHtml = await getRes.text();
    if (isLoginPage(getHtml)) throw new Error('SESSION_EXPIRED');
    
    const $ = cheerio.load(getHtml);
    const viewstate = $('[name="__VIEWSTATE"]').val() || '';
    const viewstateGen = $('[name="__VIEWSTATEGENERATOR"]').val() || '';
    const eventValidation = $('[name="__EVENTVALIDATION"]').val() || '';
    const hidBatch = $('[name="ctl00$MainContent$hid_batch"]').val() || '';
    const hidStudent = $('[name="ctl00$MainContent$hid_student"]').val() || '';
    const hdstdid = $('[name="ctl00$MainContent$hdstdid"]').val() || '0';
    
    // POST back to AttendanceDetails.aspx
    const postBody = new URLSearchParams({
      '__VIEWSTATE': viewstate,
      '__VIEWSTATEGENERATOR': viewstateGen,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$MainContent$ddlsem': body.semester,
      'ctl00$MainContent$btnsubmit': 'Submit',
      'ctl00$MainContent$hid_batch': hidBatch,
      'ctl00$MainContent$hid_student': hidStudent,
      'ctl00$MainContent$hdstdid': hdstdid
    });
    
    const postRes = await fetch(`${BASE_URL}${SPECS.sectionEndpoints.AttendanceDetails}`, {
      method: 'POST',
      headers: {
        ...PORTAL_HEADERS(cookie),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}${SPECS.sectionEndpoints.Attendance}`
      },
      body: postBody.toString(),
      redirect: 'manual'
    });
    
    if (postRes.status === 302) {
      const loc = postRes.headers.get('location') || '';
      if (loc.toLowerCase().includes('login') || loc.toLowerCase().includes('default.aspx')) {
        throw new Error('SESSION_EXPIRED');
      }
    }
    
    const postHtml = await postRes.text();
    if (isLoginPage(postHtml)) throw new Error('SESSION_EXPIRED');
    
    return parseHtml('Attendance', postHtml);
  }
  
  return scrapePage('Attendance', SPECS.sectionEndpoints.Attendance, cookie);
};

export const scrapeInternalMark = (adm, cookie) =>
  scrapePage('InternalMark', SPECS.sectionEndpoints.InternalMark, cookie);

export const scrapeInternalToUniversity = (adm, cookie) =>
  scrapePage('InternalToUniversity', SPECS.sectionEndpoints.InternalToUniversity, cookie);

export const scrapeOnlineExam = (adm, cookie) =>
  scrapePage('OnlineExam', SPECS.sectionEndpoints.OnlineExam, cookie);

export const scrapeOnlineClass = (adm, cookie) =>
  scrapePage('OnlineClass', SPECS.sectionEndpoints.OnlineClass, cookie);

export const scrapeFYUGP = (adm, cookie) =>
  scrapePage('FYUGP', SPECS.sectionEndpoints.FYUGP, cookie);

export const scrapeExamResult = (adm, cookie) =>
  scrapePage('ExamResult', SPECS.sectionEndpoints.ExamResult, cookie);

export const scrapeGraceMark = (adm, cookie) =>
  scrapePage('GraceMark', SPECS.sectionEndpoints.GraceMark, cookie);

export const scrapeHallTicket = (adm, cookie) =>
  scrapePage('HallTicket', SPECS.sectionEndpoints.HallTicket, cookie);

export const scrapeAllotmentMemo = (adm, cookie) =>
  scrapePage('AllotmentMemo', SPECS.sectionEndpoints.AllotmentMemo, cookie);

export const scrapeFeePayment = (adm, cookie) =>
  scrapePage('FeePayment', SPECS.sectionEndpoints.FeePay, cookie);

export const scrapeFeedback = (adm, cookie) =>
  scrapePage('FeedBack', SPECS.sectionEndpoints.FeedBack, cookie);

export const scrapeGrievance = (adm, cookie) =>
  scrapePage('Grievance', SPECS.sectionEndpoints.Grievance, cookie);

export const scrapeConcession = (adm, cookie) =>
  scrapePage('Concession', SPECS.sectionEndpoints.Concession, cookie);

/**
 * Route section name to scraper function.
 */
export const SCRAPERS = {
  profile: scrapeProfile,
  dashboard: scrapeDashboard,
  studyMaterial: scrapeStudyMaterial,
  assessment: scrapeAssessment,
  assignment: scrapeAssignment,
  seminar: scrapeSeminar,
  attendance: scrapeAttendance,
  internalMark: scrapeInternalMark,
  internalUniversity: scrapeInternalToUniversity,
  onlineExam: scrapeOnlineExam,
  onlineClass: scrapeOnlineClass,
  fyugp: scrapeFYUGP,
  examResult: scrapeExamResult,
  graceMark: scrapeGraceMark,
  hallTicket: scrapeHallTicket,
  allotmentMemo: scrapeAllotmentMemo,
  feePayment: scrapeFeePayment,
  feedback: scrapeFeedback,
  grievance: scrapeGrievance,
  concession: scrapeConcession,
};
