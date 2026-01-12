
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8QDzJCJ-Hsja6wK2i4ayKjPbPt5tga7Y",
  authDomain: "motomaster-pro.firebaseapp.com",
  projectId: "motomaster-pro",
  storageBucket: "motomaster-pro.firebasestorage.app",
  messagingSenderId: "95674926586",
  appId: "1:95674926586:web:fedf4c05de0cf45d789043"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
