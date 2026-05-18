import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfRvyKJdTkMHqNHJfsVd2g-hwnTjcXvL8",
  authDomain: "machub-6af39.firebaseapp.com",
  projectId: "machub-6af39",
  storageBucket: "machub-6af39.firebasestorage.app",
  messagingSenderId: "141522174204",
  appId: "1:141522174204:web:5e987cf127e4fc6112d779",
  measurementId: "G-W7FCBVLF4F"
};

const app = initializeApp(firebaseConfig);
if (!['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
  getAnalytics(app);
}

console.log("Firebase initialized.");
