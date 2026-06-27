/**
 * MacHub Global Configuration
 * Update WORKER_URL after deploying your Cloudflare Worker.
 */

// ⚠️  UPDATE THIS after deploying the Cloudflare Worker
export const WORKER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://machub-proxy.mrabensojan.workers.dev';

// TTL configuration for each data section (in milliseconds)
export const SECTION_TTL = {
  profile:            Infinity,          // Never re-fetch (TTL: never)
  dashboard:          60 * 60 * 1000,    // 1 hour
  studyMaterial:      Infinity,          // Never re-fetch
  assessment:         24 * 60 * 60 * 1000, // 24 hours
  assignment:         60 * 60 * 1000,    // 1 hour
  seminar:            24 * 60 * 60 * 1000, // 24 hours
  attendance:         30 * 60 * 1000,    // 30 minutes
  internalMark:       Infinity,          // Never re-fetch
  internalUniversity: Infinity,          // Never re-fetch
  onlineExam:         15 * 60 * 1000,    // 15 minutes
  onlineClass:        60 * 60 * 1000,    // 1 hour
  fyugp:              Infinity,          // Never re-fetch
  examResult:         60 * 60 * 1000,    // 1 hour
  graceMark:          60 * 60 * 1000,    // 1 hour
  hallTicket:         Infinity,          // Never re-fetch
  allotmentMemo:      Infinity,          // Never re-fetch
  feePayment:         24 * 60 * 60 * 1000, // 24 hours
  feedback:           Infinity,
  grievance:          Infinity,
  concession:         Infinity,
};

export const PORTAL_BASE = 'https://eportal.maraugusthinosecollege.org';
