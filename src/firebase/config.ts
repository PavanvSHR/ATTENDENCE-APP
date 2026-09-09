import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

/**
 * True only when every required Firebase env var is present. Before a real
 * `.env` is set up (see README §4), this is false and `main.tsx` renders a
 * setup notice instead of the app — the alternative is a hard crash: Firebase
 * Auth's `getAuth()` throws synchronously (`auth/invalid-api-key`) when
 * `apiKey` is falsy, and since that happens at MODULE-EVALUATION time (this
 * file runs before React ever mounts), an uncaught throw here means a
 * permanently blank page with nothing for even an error boundary to catch.
 */
export const isFirebaseConfigured = requiredEnvVars.every((key) => Boolean(import.meta.env[key]));

if (!isFirebaseConfigured) {
  for (const key of requiredEnvVars) {
    if (!import.meta.env[key]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[firebase] Missing env var ${key}. Copy .env.example to .env and fill in your Firebase project config.`
      );
    }
  }
}

const firebaseConfig = {
  // Fall back to obviously-fake placeholders when unconfigured, purely so
  // initializeApp/getAuth/getFirestore/getStorage don't throw during import.
  // isFirebaseConfigured (above) is what actually gates whether the app
  // tries to use any of these — see main.tsx.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "unconfigured-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "unconfigured.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "unconfigured-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:0:web:unconfigured",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
