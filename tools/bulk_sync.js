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
const dataManager = require('../src/utils/dataManager.js');

// ── Firebase Admin SDK ───────────────────────────────────────────────────────
function getServiceAccount() {
  // 1. Try workers/.dev.vars
  try {
    const devVarsPath = path.join(__dirname, '..', 'workers', '.dev.vars');
    if (fs.existsSync(devVarsPath)) {
      const devVars = fs.readFileSync(devVarsPath, 'utf8');
      const match = devVars.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.+)'/s);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch (e) {
    console.warn('⚠️ Failed to read workers/.dev.vars:', e.message);
  }

  // 2. Try root service_account.json or serviceAccountKey.json
  const possiblePaths = [
    path.join(__dirname, '..', 'service_account.json'),
    path.join(__dirname, '..', 'serviceAccountKey.json')
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {
      console.warn(`⚠️ Failed to read ${p}:`, e.message);
    }
  }
  return null;
}

let db;
try {
  const admin = require('firebase-admin');
  const serviceAccount = getServiceAccount();

  if (!serviceAccount) {
    throw new Error('Could not find service account key in workers/.dev.vars or root service_account.json');
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
  console.log('✅ Firebase Admin SDK connected to project:', serviceAccount.project_id);
} catch (e) {
  console.error('❌ Firebase Admin init failed:', e.message);
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
async function scrapeSection(adminNo, section, semester = null) {
  let url = `${PROXY}/api/sync-portal/${section}?admissionNumber=${adminNo}`;
  if (semester) {
    url += `&semester=${semester}`;
  }
  const res = await httpGet(url);
  if (res.status !== 200 || !res.data?.success) {
    const msg = res.data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.data.payload;  // the parsed data object
}

// Write one student's full data to Firestore using dataManager
async function writeToFirestore(student, scrapedSections) {
  const adm = student.admission_no;

  for (const [sectionName, data] of Object.entries(scrapedSections)) {
    if (data) {
      await dataManager.writeWithConflictCheck(adm, sectionName, data, 'sweep', db);
    }
  }

  // Merge student top-level info
  const docRef = db.collection('students').doc(adm);
  const payload = {
    regNo: student.regNo || '',
    classNo: student.classNo || '',
    classGroup: student.classGroup || '',
    lastSynced: new Date().toISOString(),
    syncSource: 'bulk_sync'
  };
  await docRef.set(payload, { merge: true });

  if (student.name) {
    const nameRef = db.collection('students_by_name').doc(student.name);
    await nameRef.set({
      admissionNumber: adm,
      name: student.name,
      ...payload
    }, { merge: true });
  }
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
      // Fetch existing data for conflict/sweep/archive checks
      const docSnap = await db.collection('students').doc(adm).get();
      let firestoreData = docSnap.exists ? docSnap.data() : null;

      if (!profileOnly) {
        // Scrape default first
        for (const section of SECTIONS_TO_SYNC) {
          if (!dataManager.shouldSweepWrite(section, firestoreData)) {
            process.stdout.write('s');
            continue;
          }
          try {
            const data = await scrapeSection(adm, section);
            scrapedSections[section] = data;
            process.stdout.write('.');
          } catch (secErr) {
            process.stdout.write('x');
          }
        }

        // Detect semester change
        const profileData = scrapedSections['Profile'];
        if (profileData) {
          const storedProfile = firestoreData?.profile?.data || {};
          if (dataManager.detectSemesterChange(storedProfile, profileData)) {
            const newSem = profileData.semester || '';
            process.stdout.write(` [Archiving old sem -> ${newSem}] `);
            await dataManager.archiveSemesterData(adm, db, newSem);
            // Refresh firestoreData reference
            const updatedSnap = await db.collection('students').doc(adm).get();
            firestoreData = updatedSnap.exists ? updatedSnap.data() : null;
          }
        }

        // Detect available semesters from default Attendance or Assessment
        const attData = scrapedSections['Attendance'];
        const semesters = attData?.semesters || attData?.semesterOptions || [];
        const activeSem = semesters.find(s => s.selected || s.active)?.value;

        // Find other semesters
        const otherSemesters = semesters
          .map(s => s.value)
          .filter(val => val && val !== activeSem);

        if (otherSemesters.length > 0) {
          process.stdout.write(` [Extra Sems: ${otherSemesters.join(', ')}] `);
          for (const sem of otherSemesters) {
            const semSections = ['Attendance', 'Assessment', 'InternalMark', 'ExamResult'];
            for (const section of semSections) {
              const cacheKeyName = `${section}_sem${sem}`;
              if (!dataManager.shouldSweepWrite(cacheKeyName, firestoreData)) {
                process.stdout.write('s');
                continue;
              }
              try {
                const data = await scrapeSection(adm, section, sem);
                scrapedSections[cacheKeyName] = data;
                process.stdout.write('.');
              } catch (secErr) {
                process.stdout.write('x');
              }
            }
          }
        }
      }

      await writeToFirestore(s, scrapedSections);
      const scraped = Object.keys(scrapedSections).length;
      console.log(` ✅ ${scraped} keys synced`);
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
