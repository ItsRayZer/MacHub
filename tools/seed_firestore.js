/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — Firestore Seed Script                           ║
 * ║   Populates departments, batches, and divisions                  ║
 * ║   Usage: node tools/seed_firestore.js [--dry-run]                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const admin = require('firebase-admin');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.resolve(__dirname, '..', 'serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  // Try default credentials (for CI/CD environments)
  console.warn(`[Seed] Could not load service account from ${serviceAccountPath}, using default credentials`);
  admin.initializeApp();
}

const db = admin.firestore();

// ─── Seed Data ──────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { name: 'Bachelor of Computer Applications', code: 'BCA' },
  { name: 'Bachelor of Business Administration', code: 'BBA' },
  { name: 'Bachelor of Commerce', code: 'BCOM' },
  { name: 'Bachelor of Science in Computer Science', code: 'BSC_CS' },
];

const CURRENT_YEAR = new Date().getFullYear();

// Generate batches for current and recent academic years
function generateBatches(departmentId, departmentCode) {
  const batches = [];
  const programDuration = departmentCode === 'BSC_CS' ? 3 : 3; // All programs are 3 years

  // Generate batches: current, previous, and next year starts
  for (let startYear = CURRENT_YEAR - 2; startYear <= CURRENT_YEAR; startYear++) {
    const endYear = startYear + programDuration;
    const elapsed = CURRENT_YEAR - startYear;
    // Current semester: each year has 2 semesters
    const currentSemester = Math.min(elapsed * 2 + (new Date().getMonth() >= 5 ? 2 : 1), programDuration * 2);

    batches.push({
      departmentId,
      departmentCode,
      startYear,
      endYear,
      currentSemester,
      label: `${departmentCode} ${startYear}-${endYear}`,
    });
  }
  return batches;
}

const DIVISIONS = ['A', 'B'];

// ─── Seed Execution ─────────────────────────────────────────────────────────

async function seedFirestore() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  MAC Exam Hub — Firestore Seed Script        ║`);
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to Firestore)'}       ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  let deptCount = 0;
  let batchCount = 0;
  let divisionCount = 0;

  // ── 1. Seed Departments ─────────────────────────────────────────────────
  console.log('📚 Seeding departments...');
  const deptIdMap = {};

  for (const dept of DEPARTMENTS) {
    // Use code as document ID for deterministic references
    const docId = dept.code.toLowerCase();
    const data = {
      name: dept.name,
      code: dept.code,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (DRY_RUN) {
      console.log(`  [DRY] departments/${docId}:`, JSON.stringify(data));
    } else {
      await db.collection('departments').doc(docId).set(data, { merge: true });
      console.log(`  ✅ departments/${docId}: ${dept.name}`);
    }

    deptIdMap[dept.code] = docId;
    deptCount++;
  }

  // ── 2. Seed Batches ─────────────────────────────────────────────────────
  console.log('\n📅 Seeding batches...');
  const batchIdMap = {};

  for (const dept of DEPARTMENTS) {
    const deptDocId = deptIdMap[dept.code];
    const batches = generateBatches(deptDocId, dept.code);

    for (const batch of batches) {
      const docId = `${batch.departmentCode.toLowerCase()}_${batch.startYear}`;
      const data = {
        departmentId: deptDocId,
        startYear: batch.startYear,
        endYear: batch.endYear,
        currentSemester: batch.currentSemester,
        label: batch.label,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] batches/${docId}:`, JSON.stringify(data));
      } else {
        await db.collection('batches').doc(docId).set(data, { merge: true });
        console.log(`  ✅ batches/${docId}: ${batch.label} (Sem ${batch.currentSemester})`);
      }

      batchIdMap[docId] = true;
      batchCount++;
    }
  }

  // ── 3. Seed Divisions ───────────────────────────────────────────────────
  console.log('\n🏫 Seeding divisions...');

  for (const batchDocId of Object.keys(batchIdMap)) {
    for (const div of DIVISIONS) {
      const docId = `${batchDocId}_${div.toLowerCase()}`;
      const data = {
        batchId: batchDocId,
        name: `${div} Division`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] divisions/${docId}:`, JSON.stringify(data));
      } else {
        await db.collection('divisions').doc(docId).set(data, { merge: true });
        console.log(`  ✅ divisions/${docId}: ${div} Division`);
      }

      divisionCount++;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Seed complete!`);
  console.log(`   Departments: ${deptCount}`);
  console.log(`   Batches:     ${batchCount}`);
  console.log(`   Divisions:   ${divisionCount}`);
  console.log(`   Total docs:  ${deptCount + batchCount + divisionCount}`);
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — no data was written. Run without --dry-run to seed Firestore.`);
  }
}

seedFirestore()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
