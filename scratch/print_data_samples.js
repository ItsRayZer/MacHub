const admin = require('firebase-admin');
const fs = require('fs');

const devVars = fs.readFileSync('workers/.dev.vars', 'utf8');
const match = devVars.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.+)'/s);
const serviceAccount = JSON.parse(match[1]);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  const snap = await db.collection('students').doc('12965').get();
  const data = snap.data();
  
  if (data.ExamResult) {
    console.log("ExamResult structure:");
    const results = data.ExamResult.data?.payload?.results || data.ExamResult.data?.results || [];
    console.log(`Results count: ${results.length}`);
    if (results.length > 0) {
      console.log(`First result headers:`, JSON.stringify(results[0].headers));
      console.log(`First result sample row:`, JSON.stringify(results[0].rows?.[0]));
    }
  }

  if (data.Assessment) {
    console.log("\nAssessment structure:");
    const sections = data.Assessment.data?.payload?.sections || data.Assessment.data?.sections || [];
    console.log(`Assessment sections count: ${sections.length}`);
    if (sections.length > 0) {
      console.log(`First section sample:`, JSON.stringify(sections[0]));
    }
  }
  
  const snap2 = await db.collection('students').doc('12824').get();
  const data2 = snap2.data();
  if (data2.InternalMark) {
    console.log("\nInternalMark structure:");
    const subjects = data2.InternalMark.data?.payload?.subjects || data2.InternalMark.data?.subjects || [];
    console.log(`InternalMark subjects count: ${subjects.length}`);
    if (subjects.length > 0) {
      console.log(`First subject sample:`, JSON.stringify(subjects[0]));
    }
  }

  process.exit(0);
}

main().catch(console.error);
