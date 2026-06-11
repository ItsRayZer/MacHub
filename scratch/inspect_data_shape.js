const admin = require('firebase-admin');
const fs = require('fs');

const devVars = fs.readFileSync('workers/.dev.vars', 'utf8');
const match = devVars.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.+)'/s);
const serviceAccount = JSON.parse(match[1]);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function showData(sec, d) {
  if (!d) { console.log(`  data: null`); return; }
  const keys = Object.keys(d);
  console.log(`  data keys: [${keys.join(', ')}]`);
  
  // Detect array fields
  keys.forEach(k => {
    if (Array.isArray(d[k])) {
      console.log(`  ${k}: Array(${d[k].length})`);
      if (d[k][0]) console.log(`    [0]: ${JSON.stringify(d[k][0]).slice(0, 200)}`);
    } else if (d[k] && typeof d[k] === 'object') {
      const subkeys = Object.keys(d[k]);
      console.log(`  ${k}: Object {${subkeys.join(', ')}}`);
      subkeys.forEach(sk => {
        if (Array.isArray(d[k][sk])) console.log(`    ${sk}: Array(${d[k][sk].length})`);
      });
    }
  });
}

async function main() {
  // Check 12965 which has Attendance + ExamResult
  const snap = await db.collection('students').doc('12965').get();
  const data = snap.data();
  
  const sections = ['Attendance', 'AttendanceDetails', 'ExamResult', 'Assessment', 'InternalMark', 'Dashboard'];
  for (const sec of sections) {
    const secData = data[sec];
    if (!secData) { console.log(`\n❌ ${sec}: missing`); continue; }
    const cachedAt = secData.cachedAt?.toDate?.() || secData.cachedAt;
    console.log(`\n=== ${sec} (cached: ${cachedAt ? new Date(cachedAt).toLocaleString() : 'N/A'}) ===`);
    showData(sec, secData.data);
  }

  // Also check 12824 which has InternalMark
  console.log('\n\n--- Student 12824 (has InternalMark) ---');
  const snap2 = await db.collection('students').doc('12824').get();
  const data2 = snap2.data();
  for (const sec of ['InternalMark', 'ExamResult', 'Assessment']) {
    const secData = data2[sec];
    if (!secData) { console.log(`\n❌ ${sec}: missing`); continue; }
    const cachedAt = secData.cachedAt?.toDate?.() || secData.cachedAt;
    console.log(`\n=== ${sec} (cached: ${cachedAt ? new Date(cachedAt).toLocaleString() : 'N/A'}) ===`);
    showData(sec, secData.data);
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
