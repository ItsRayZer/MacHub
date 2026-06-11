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
  
  // Dump everything except large logs
  const cleaned = {};
  for (const k of Object.keys(data)) {
    cleaned[k] = {
      hasData: !!data[k].data,
      cachedAt: data[k].cachedAt?.toDate?.() || data[k].cachedAt,
      keys: data[k].data ? Object.keys(data[k].data) : null,
      preview: data[k].data ? JSON.stringify(data[k].data).slice(0, 1000) : null
    };
  }
  fs.writeFileSync('scratch/student_12965_dump.json', JSON.stringify(cleaned, null, 2));
  console.log("Dumped to scratch/student_12965_dump.json");
  process.exit(0);
}

main().catch(console.error);
