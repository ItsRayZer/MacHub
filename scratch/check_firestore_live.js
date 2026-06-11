const admin = require('firebase-admin');
const fs = require('fs');

// Extract SA from .dev.vars
const devVars = fs.readFileSync('workers/.dev.vars', 'utf8');
const match = devVars.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.+)'/s);
if (!match) { console.error('Cannot find service account'); process.exit(1); }
const serviceAccount = JSON.parse(match[1]);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function checkStudentData(admNo) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Student: ${admNo}`);
  console.log('='.repeat(50));
  const snap = await db.collection('students').doc(admNo).get();
  
  if (!snap.exists) { console.log('❌ No document found'); return; }
  
  const data = snap.data();
  console.log(`Top-level document keys: [${Object.keys(data).join(', ')}]`);
  
  const toCheck = ['attendance', 'examResult', 'internalMark', 'assessment', 'Attendance', 'ExamResult', 'InternalMark', 'Assessment'];
  
  for (const sec of toCheck) {
    const secData = data[sec];
    if (!secData) continue;
    const cachedAt = secData.cachedAt?.toDate?.() || secData.cachedAt;
    const d = secData.data;
    console.log(`\n✅ ${sec} (cached: ${cachedAt ? new Date(cachedAt).toLocaleString() : 'never'})`);
    
    if (!d) { console.log('   data: null'); continue; }
    
    const topKeys = Object.keys(d);
    console.log(`   top-level keys: [${topKeys.join(', ')}]`);
    
    // Attendance
    if (sec === 'attendance') {
      const recs = d.records || d.data || (d.subjectWise && d.subjectWise.data) || [];
      const sems = d.semesters || d.semesterOptions || [];
      console.log(`   records: ${recs.length}, semesters: ${sems.length}`);
      if (recs[0]) console.log(`   sample record: ${JSON.stringify(recs[0]).slice(0,300)}`);
      // check nested
      if (d.details) console.log(`   details keys: [${Object.keys(d.details).join(', ')}]`);
      if (d.subjectWise) {
        console.log(`   subjectWise keys: [${Object.keys(d.subjectWise).join(', ')}]`);
        const sw = d.subjectWise.data || d.subjectWise.sections || [];
        console.log(`   subjectWise data: ${sw.length} items`);
        if (sw[0]) console.log(`   sw sample: ${JSON.stringify(sw[0]).slice(0,200)}`);
      }
    }
    
    // ExamResult
    if (sec === 'examResult') {
      const results = d.results || d.sections || d.data || [];
      console.log(`   results count: ${results.length}`);
      if (results[0]) console.log(`   sample: ${JSON.stringify(results[0]).slice(0,300)}`);
    }
    
    // InternalMark
    if (sec === 'internalMark') {
      const subjs = d.subjects || d.sections || d.data || [];
      console.log(`   subjects count: ${subjs.length}`);
      if (subjs[0]) console.log(`   sample: ${JSON.stringify(subjs[0]).slice(0,300)}`);
    }
    
    // Assessment
    if (sec === 'assessment') {
      const secs = d.sections || d.data || [];
      console.log(`   sections count: ${secs.length}`);
      if (secs[0]) console.log(`   sample: ${JSON.stringify(secs[0]).slice(0,300)}`);
    }
  }
}

async function main() {
  for (const adm of ['12965', '12966', '12967']) {
    try { await checkStudentData(adm); } catch(e) { console.error(`Error ${adm}:`, e.message); }
  }
  process.exit(0);
}

main();
