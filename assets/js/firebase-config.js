// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1sNorLeQxKLLV2xzW_CeLPfCY9kdbHdU",
  authDomain: "popflix-fa92d.firebaseapp.com",
  projectId: "popflix-fa92d",
  storageBucket: "popflix-fa92d.appspot.com",
  messagingSenderId: "711247539554",
  appId: "1:711247539554:android:032d6028c7d514fbb3103b",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);