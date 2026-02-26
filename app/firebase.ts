// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration (client-side keys are public by design)
const firebaseConfig = {
  apiKey: "AIzaSyCKco1J5ZPYz6G0pcXFrgiL70fON7pVSPE",
  authDomain: "conversao-fotos.firebaseapp.com",
  projectId: "conversao-fotos",
  storageBucket: "conversao-fotos.firebasestorage.app",
  messagingSenderId: "322589561472",
  appId: "1:322589561472:web:dad7aafd6808613cc8cc65"
};

// Initialize Firebase safely for Next.js SSR
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);