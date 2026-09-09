/**
 * Initializes firebase-admin using EXACTLY ONE of two supported credential
 * sources (see .env.example):
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: the full service account JSON pasted
 *     as a single-line env var string.
 *   - GOOGLE_APPLICATION_CREDENTIALS: a filesystem path to a service account
 *     key file, picked up automatically by admin.credential.applicationDefault().
 *
 * firebase-admin bypasses Firestore security rules entirely, which is why
 * this server (not the client SDK) is the trusted, privileged actor for all
 * authorization / verification-verdict / duplicate-check / risk-scoring
 * decisions described in the API contract.
 */
import admin from "firebase-admin";

function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountJson) {
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch (err) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. " +
          "Make sure the entire service account file is pasted as a single-line string."
      );
    }
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId,
    });
  }

  if (googleAppCreds) {
    // admin.credential.applicationDefault() reads GOOGLE_APPLICATION_CREDENTIALS
    // from the environment itself.
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }

  throw new Error(
    "No Firebase Admin credentials found. Set either FIREBASE_SERVICE_ACCOUNT_JSON " +
      "or GOOGLE_APPLICATION_CREDENTIALS in your environment (see .env.example)."
  );
}

const app = initializeFirebaseAdmin();

export const db = admin.firestore(app);
export const authAdmin = admin.auth(app);
export default admin;
