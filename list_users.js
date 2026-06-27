import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = 'C:\\Projects\\Machub\\machub-hf-space\\firebase_credentials.json';

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  if (admin.apps.length > 0) {
    await admin.apps[0].delete();
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Listing Firebase Auth users...');
  const listUsersResult = await admin.auth().listUsers(10);
  listUsersResult.users.forEach((userRecord) => {
    console.log(`- UID: ${userRecord.uid}, Email: ${userRecord.email}, DisplayName: ${userRecord.displayName}`);
  });
  
} catch (err) {
  console.error('Failed to list users:', err);
}
