import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = 'C:\\Projects\\Machub\\machub-hf-space\\firebase_credentials.json';

// Simple manual .env parser
const envPath = 'c:\\Users\\abens\\OneDrive\\Documents\\02_Projects\\Active_Projects\\MacHub Admin Dashbroad\\.env';
const envConfig = {};
if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf8');
  fileContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      envConfig[match[1]] = value;
    }
  });
}

async function testBucket(bucketName) {
  console.log(`\n=================== Testing admin upload to bucket: ${bucketName} ===================`);
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    // Check if an app is already initialized
    if (admin.apps.length > 0) {
      await admin.apps[0].delete();
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });

    const bucket = admin.storage().bucket();
    const file = bucket.file('students/photos/TEST999/front.jpg');
    
    console.log(`Attempting to upload file to ${bucketName}...`);
    await file.save('Hello from Firebase Admin storage test', {
      metadata: { contentType: 'image/jpeg' }
    });
    
    console.log('Upload successful!');
    
    // Try to get download URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });
    console.log('Signed Download URL:', url);
    return true;
  } catch (err) {
    console.error(`Firebase Admin storage test failed for ${bucketName}:`, err);
    return false;
  }
}

async function main() {
  const defaultBucket = envConfig.VITE_FIREBASE_STORAGE_BUCKET || 'machub-6af39.firebasestorage.app';
  const altBucket = 'machub-6af39.appspot.com';
  
  await testBucket(defaultBucket);
  await testBucket(altBucket);
}

main();
