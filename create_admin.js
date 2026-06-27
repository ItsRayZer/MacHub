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

  const email = 'admin@machub.in';
  const password = 'machub123';

  console.log(`Checking if ${email} exists...`);
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`User ${email} already exists with UID: ${userRecord.uid}`);
    
    // Update password just in case
    await admin.auth().updateUser(userRecord.uid, {
      password: password
    });
    console.log(`Updated password for ${email} to ${password}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`User ${email} not found. Creating it...`);
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        emailVerified: true
      });
      console.log(`Successfully created user ${email} with UID: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }
  
} catch (err) {
  console.error('Failed to create/update admin user:', err);
}
