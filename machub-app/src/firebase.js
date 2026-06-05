import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCfRvyKJdTkMHqNHJfsVd2g-hwnTjcXvL8",
  authDomain: "machub-6af39.firebaseapp.com",
  databaseURL: "https://machub-6af39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "machub-6af39",
  storageBucket: "machub-6af39.firebasestorage.app",
  messagingSenderId: "141522174204",
  appId: "1:141522174204:web:5e987cf127e4fc6112d779",
  measurementId: "G-W7FCBVLF4F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence for instant loads
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence disabled (multiple tabs open)');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this browser');
    }
  });
} catch (err) {
  console.warn('Firestore persistence setup failed:', err);
}

/**
 * Sign in using custom token received from the Cloudflare Worker.
 */
export async function authenticateWithToken(token) {
  try {
    const userCredential = await signInWithCustomToken(auth, token);
    return userCredential.user;
  } catch (error) {
    console.error("Custom token authentication failed:", error);
    throw error;
  }
}

/**
 * Sign out from Firebase Auth.
 */
export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out failed:", error);
  }
}

/**
 * Check if a user is currently authenticated and retrieve their details.
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export default app;
