const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Resolves the Firebase Service Account key from .dev.vars or service_account.json files.
 */
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
    console.warn('[Rankings Compiler] Failed to read workers/.dev.vars:', e.message);
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
      console.warn(`[Rankings Compiler] Failed to read ${p}:`, e.message);
    }
  }

  return null;
}

/**
 * Parses overall attendance statistics from a student document.
 */
function parseAttendance(docData) {
  let attField = docData?.Attendance || docData?.attendance;
  
  if (!attField || !attField.data) {
    const semStr = String(docData?.semester || docData?.Profile?.data?.semester || '').match(/\d+/)?.[0];
    if (semStr) {
      attField = docData?.[`Attendance_sem${semStr}`];
    }
  }

  if (!attField || !attField.data) {
    const keys = Object.keys(docData || {});
    const semKey = keys.find(k => k.startsWith('Attendance_sem'));
    if (semKey) {
      attField = docData[semKey];
    }
  }

  if (!attField) return null;

  let rawData = attField.data;
  if (!rawData) return null;

  let parsed = rawData;
  if (typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData);
    } catch (e) {
      return null;
    }
  }

  // Handle various nesting layouts in ePortal payload
  const rows = parsed?.payload?.sections?.[0]?.rows || 
               parsed?.sections?.[0]?.rows || 
               parsed?.data?.payload?.sections?.[0]?.rows ||
               parsed?.data?.sections?.[0]?.rows || 
               parsed?.rows || [];

  if (!Array.isArray(rows) || rows.length === 0) return null;

  let presentSum = 0;
  let totalSum = 0;
  let hasValidSubject = false;

  rows.forEach(row => {
    if (row.subjectName) {
      const present = parseInt(row.presentHours) || 0;
      const total = parseInt(row.totalHours) || 0;
      presentSum += present;
      totalSum += total;
      hasValidSubject = true;
    }
  });

  if (!hasValidSubject || totalSum === 0) return null;

  return {
    presentHours: presentSum,
    totalHours: totalSum,
    percentage: Math.round((presentSum / totalSum) * 1000) / 10
  };
}

/**
 * Compiles rankings for all BCA 2025 students and saves the result to Firestore.
 */
async function compileRankings() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error('Firebase service account key not found. Place it in workers/.dev.vars or service_account.json.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();

  // Load BCA 2025 student list from students_all.json
  const studentsPath = path.join(__dirname, '..', 'students_all.json');
  if (!fs.existsSync(studentsPath)) {
    throw new Error('students_all.json not found in workspace.');
  }

  const studentList = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
  console.log(`[Rankings Compiler] Loaded ${studentList.length} students from students_all.json`);

  // We fetch all student documents in a single round-trip using db.getAll()
  const docRefs = studentList.map(s => db.collection('students').doc(s.admission_no));
  console.log(`[Rankings Compiler] Fetching Firestore documents in batch...`);
  const docs = await db.getAll(...docRefs);
  console.log(`[Rankings Compiler] Retrieved ${docs.length} documents.`);

  const activeList = [];
  const pendingList = [];

  docs.forEach((doc, idx) => {
    const student = studentList[idx];
    if (doc.exists) {
      const docData = doc.data();
      const attStats = parseAttendance(docData);
      const photoUrl = docData.customProfile?.overrides?.photoUrl || 
                       docData.photoUrl || 
                       docData.Profile?.data?.payload?.photoUrl ||
                       docData.Profile?.data?.payload?.sections?.[0]?.data?.photoUrl || 
                       '';
      
      if (attStats) {
        activeList.push({
          admissionNumber: student.admission_no,
          name: student.name,
          classNo: student.classNo || '',
          classGroup: student.classGroup || '',
          presentHours: attStats.presentHours,
          totalHours: attStats.totalHours,
          attendancePct: attStats.percentage,
          photoUrl: photoUrl
        });
      } else {
        pendingList.push({
          admissionNumber: student.admission_no,
          name: student.name,
          classNo: student.classNo || '',
          classGroup: student.classGroup || '',
          presentHours: 0,
          totalHours: 0,
          attendancePct: null,
          status: 'Pending Sync',
          photoUrl: photoUrl
        });
      }
    } else {
      pendingList.push({
        admissionNumber: student.admission_no,
        name: student.name,
        classNo: student.classNo || '',
        classGroup: student.classGroup || '',
        presentHours: 0,
        totalHours: 0,
        attendancePct: null,
        status: 'Pending Sync',
        photoUrl: ''
      });
    }
  });

  // Sort activeList descending by attendancePct
  activeList.sort((a, b) => b.attendancePct - a.attendancePct);

  // Assign ranks handling ties (1, 2, 2, 4 style)
  let currentRank = 1;
  let prevPct = null;
  activeList.forEach((s, idx) => {
    if (prevPct !== null && s.attendancePct < prevPct) {
      currentRank = idx + 1;
    }
    s.rank = currentRank;
    prevPct = s.attendancePct;
  });

  // Combine active and pending lists
  const combinedRankings = [...activeList, ...pendingList];

  // Write rankings document to Firestore
  const rankingsDocRef = db.collection('rankings').doc('bca_2025');
  await rankingsDocRef.set({
    batch: 'BCA 2025',
    compiledAt: new Date().toISOString(),
    rankings: combinedRankings
  });

  console.log(`[Rankings Compiler] Successfully compiled rankings for ${combinedRankings.length} students.`);
  return combinedRankings;
}

// Allow running directly from command line
if (require.main === module) {
  compileRankings()
    .then(() => {
      console.log('✅ Rankings compilation finished successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Compilation failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  compileRankings,
  parseAttendance
};
