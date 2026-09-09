/**
 * Shared Firebase Admin SDK initialization for all Cloud Functions in this
 * codebase. Cloud Functions running in Firebase's own infrastructure get
 * project credentials automatically (no service account JSON / env vars
 * needed here — see the note in src/index.ts), so a bare
 * `admin.initializeApp()` is sufficient, unlike server/'s local Express
 * process which must be told which credentials to use.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const app = getApps().length ? getApps()[0] : initializeApp();
export const db = getFirestore(app);
