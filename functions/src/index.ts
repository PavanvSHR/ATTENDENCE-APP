/**
 * Cloud Functions entry point — barrel export of every deployed function.
 *
 * Environment / configuration: NONE needed beyond what Firebase provides
 * automatically. Unlike server/ (a standalone Express process that must be
 * handed Firebase Admin credentials explicitly via FIREBASE_SERVICE_ACCOUNT_JSON
 * or GOOGLE_APPLICATION_CREDENTIALS — see server/.env.example), Cloud
 * Functions run inside Firebase's own infrastructure and get project
 * credentials and config injected automatically. `admin.initializeApp()`
 * with no arguments (see ./admin.ts) is all that's required. See
 * functions/.env.example for the (empty, documented) confirmation of this.
 */

export { onAttendanceRecordWrite } from "./triggers/onAttendanceRecordWrite";
export { onSessionStatusChange } from "./triggers/onSessionStatusChange";
export { lowAttendanceCheck } from "./scheduled/lowAttendanceCheck";
export { expireOpenSessions } from "./scheduled/expireOpenSessions";
