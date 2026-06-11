const admin = require('firebase-admin');
const fs = require('fs');

const devVars = fs.readFileSync('workers/.dev.vars', 'utf8');
const match = devVars.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.+)'/s);
if (!match) { console.error('Cannot find service account'); process.exit(1); }
const serviceAccount = JSON.parse(match[1]);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  // List all documents in students collection
  const snap = await db.collection('students').get();
  console.log(`Total students docs: ${snap.size}`);
  snap.forEach(doc => {
    const d = doc.data();
    const keys = Object.keys(d);
    console.log(`\nDoc: ${doc.id}`);
    console.log(`  Fields: ${keys.join(', ')}`);
  });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
