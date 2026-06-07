/**
 * bulk_sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk syncs all BCA students to Firebase Firestore:
 *   1. Writes student profile info (name, reg, classNo, etc.) immediately
 *   2. Calls the local proxy server GET /api/sync-portal/:section?admissionNumber=X
 *      for each important section
 *   3. Merges all scraped section data into Firestore under  students/{adminNo}
 *
 * Usage:
 *   node tools/bulk_sync.js                   # all students
 *   node tools/bulk_sync.js --start=5         # resume from index 5
 *   node tools/bulk_sync.js --id=12965        # single student
 *   node tools/bulk_sync.js --profile-only    # only write basic profile info
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── Firebase Admin SDK ───────────────────────────────────────────────────────
let db;
try {
  const admin        = require('firebase-admin');
  const saPath       = path.join(__dirname, '..', 'service_account.json');
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
  console.log('✅ Firebase Admin SDK connected to project:', serviceAccount.project_id);
} catch (e) {
  console.error('❌ Firebase Admin init failed:', e.message);
  console.error('   Place your service_account.json in the project root and retry.');
  process.exit(1);
}

// ── Config ───────────────────────────────────────────────────────────────────
const PROXY   = 'http://localhost:3001';
const DELAY   = { min: 2500, max: 4500 };     // ms between students
const TIMEOUT = 35000;                         // ms per section request

// Sections to scrape per student (most important first)
const SECTIONS_TO_SYNC = [
  'Attendance',
  'Assessment',
  'Profile',
  'InternalMark',
  'ExamResult',
  'StudyMaterial',
  'Assignment',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (mn, mx) => Math.floor(Math.random() * (mx - mn) + mn);

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: TIMEOUT }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// Scrape one section for one student
async function scrapeSection(adminNo, section) {
  const url = `${PROXY}/api/sync-portal/${section}?admissionNumber=${adminNo}`;
  const res = await httpGet(url);
  if (res.status !== 200 || !res.data?.success) {
    const msg = res.data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.data.payload;  // the parsed data object
}

// Write one student's full data to Firestore
async function writeToFirestore(student, scrapedSections) {
  const adm    = student.admission_no;
  const docRef = db.collection('students').doc(adm);

  const payload = {
    admissionNumber: adm,
    name           : student.name,
    regNo          : student.regNo,
    classNo        : student.classNo,
    classGroup     : student.classGroup,
    department     : student.department,
    semester       : student.semester,
    lastSynced     : new Date().toISOString(),
    syncSource     : 'bulk_sync'
  };

  for (const [section, data] of Object.entries(scrapedSections)) {
    if (data) {
      payload[section] = { data, cachedAt: new Date().toISOString() };
    }
  }

  await docRef.set(payload, { merge: true });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args        = process.argv.slice(2);
  const startArg    = args.find(a => a.startsWith('--start='));
  const idArg       = args.find(a => a.startsWith('--id='));
  const profileOnly = args.includes('--profile-only');
  const startIdx    = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

  const allStudents = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'students_all.json'), 'utf8')
  );

  let queue = allStudents;
  if (idArg) {
    const id = idArg.split('=')[1];
    queue = allStudents.filter(s => s.admission_no === id);
    if (!queue.length) { console.error(`Student ${id} not found`); process.exit(1); }
  } else {
    queue = allStudents.slice(startIdx);
  }

  const mode = profileOnly ? 'PROFILE ONLY (no scraping)' : `scraping ${SECTIONS_TO_SYNC.join(', ')}`;
  console.log(`\n📋 Syncing ${queue.length} students — ${mode}`);
  console.log(`🔗 Proxy  : ${PROXY}`);
  console.log(`📄 Total  : ${allStudents.length} students in students_all.json\n`);

  let success = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < queue.length; i++) {
    const s   = queue[i];
    const adm = s.admission_no;
    const num = startIdx + i + 1;

    process.stdout.write(`[${String(num).padStart(2)}/${allStudents.length}] ${adm}  ${s.name.padEnd(26)} `);

    const scrapedSections = {};
    let studentOk = true;

    try {
      if (!profileOnly) {
        for (const section of SECTIONS_TO_SYNC) {
          try {
            const data = await scrapeSection(adm, section);
            scrapedSections[section] = data;
            process.stdout.write('.');
          } catch (secErr) {
            process.stdout.write('x');
            // Not a fatal failure — continue with other sections
          }
        }
      }

      await writeToFirestore(s, scrapedSections);
      const scraped = Object.keys(scrapedSections).length;
      console.log(` ✅ ${scraped}/${SECTIONS_TO_SYNC.length} sections`);
      success++;
    } catch (err) {
      console.log(` ❌ ${err.message.slice(0, 70)}`);
      failed++;
      studentOk = false;
      errors.push({ adm, name: s.name, error: err.message });
    }

    // Throttle between students
    if (i < queue.length - 1) {
      const delay = rand(DELAY.min, DELAY.max);
      await sleep(delay);
    }
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`  ✅ Success  : ${success}  |  ❌ Failed : ${failed}`);
  console.log(`${'='.repeat(55)}\n`);

  if (errors.length) {
    const errFile = path.join(__dirname, '..', 'sync_errors.json');
    fs.writeFileSync(errFile, JSON.stringify(errors, null, 2));
    console.log(`⚠️  Failed list saved → sync_errors.json`);
    console.log(`   Re-run failed: node tools/bulk_sync.js --id=XXXXX\n`);
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
