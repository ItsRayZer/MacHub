import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-ai.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfRvyKJdTkMHqNHJfsVd2g-hwnTjcXvL8",
  authDomain: "machub-6af39.firebaseapp.com",
  projectId: "machub-6af39",
  storageBucket: "machub-6af39.firebasestorage.app",
  messagingSenderId: "141522174204",
  appId: "1:141522174204:web:5e987cf127e4fc6112d779",
  measurementId: "G-W7FCBVLF4F",
  databaseURL: "https://machub-6af39-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Expose database references globally
window.firebaseDb = db;
window.firebaseDbRef = ref;
window.firebaseDbOnValue = onValue;
window.firebaseDbGet = get;

window.firebaseFirestore = firestore;
window.firestoreDoc = doc;
window.firestoreGetDoc = getDoc;
window.firestoreSetDoc = setDoc;
window.firestoreUpdateDoc = updateDoc;

window.firebaseAuth = auth;
window.firebaseSignInWithCustomToken = signInWithCustomToken;
window.firebaseOnAuthStateChanged = onAuthStateChanged;
window.firebaseSignOut = signOut;

window.firebaseStorage = storage;
window.storageRef = sRef;
window.storageUploadBytes = uploadBytesResumable;
window.storageGetDownloadURL = getDownloadURL;
window.storageDeleteObject = deleteObject;
// ── Firebase AI Logic → Gemini Developer API (no billing required) ──────────
// Requires: Firebase Console → Build → AI Logic → Enabled ✅
try {
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const gemini = getGenerativeModel(ai, {
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  });

  window._macaiGemini = gemini;
  console.log("✅ MacAI: Firebase AI Logic (Gemini 2.0 Flash) ready.");

} catch (err) {
  console.error("❌ MacAI: Firebase AI init failed —", err.message);
  window._macaiGemini = null;
}
