// =====================================================
// KONFIGURASI FIREBASE - Egenda Kelas SMAN 5 Sarolangun
// File ini dipakai oleh semua halaman aplikasi
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1p_ZWco5ERzi7u-dzQOJbA_nVewS3ahE",
  authDomain: "agedasmanli.firebaseapp.com",
  projectId: "agedasmanli",
  storageBucket: "agedasmanli.firebasestorage.app",
  messagingSenderId: "969562298791",
  appId: "1:969562298791:web:320a29a007c74739217e82"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
