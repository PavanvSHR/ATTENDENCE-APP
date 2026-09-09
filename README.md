# Smart Attendance Management System

A production-shaped, anti-proxy attendance system for a college/class. Teachers and authorized
Class Representatives (CRs) take attendance via biometric, face, GPS geofencing, QR, or manual
verification; students self-mark from their phone. Every privileged decision — duplicate checks,
geofence distance, biometric/face verdicts, risk scoring, session state transitions — is decided
**server-side**, never trusted from the browser.

See also: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (schema + verification pipeline + API
contract), [`docs/TESTING.md`](docs/TESTING.md) (manual QA checklist), and
[`docs/ANDROID_INTEGRATION.md`](docs/ANDROID_INTEGRATION.md) (what changes once wrapped in
Capacitor for a real Android app).

## Architecture at a glance

- **Frontend** (`/`): React 18 + Vite + TypeScript + Tailwind, role-based routing (admin / teacher
  / cr / student), Firebase client SDK for auth + live reads.
- **Backend** (`server/`): Node + Express + TypeScript, using the **Firebase Admin SDK** (which
  bypasses Firestore Security Rules) — this is the one trusted, privileged actor for attendance
  writes, audit logs, and session state.
- **Cloud Functions** (`functions/`): Firestore triggers (notifications on attendance/session
  events) and scheduled jobs (low-attendance alerts, auto-expiring stale open sessions).
- **Firestore**: `firestore.rules` locks down direct client writes to attendance-critical
  collections (`attendanceSessions`, `attendanceRecords`, `auditLogs`) — those are written only by
  `server/` or Cloud Functions. Admin can read/write the academic-directory collections
  (departments/classes/students/teachers/etc) directly from the browser.

## 1. Prerequisites

- [Node.js](https://nodejs.org/) 20 LTS or newer, and npm.
- A [Firebase](https://console.firebase.google.com/) project (free Spark plan is enough to start;
  Cloud Functions on a schedule require the Blaze pay-as-you-go plan).
- (Optional, for the Android path) [Android Studio](https://developer.android.com/studio).

## 2. Create the Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. **Build → Authentication → Get started.** Enable **Email/Password** and **Google** sign-in
   providers.
3. **Build → Firestore Database → Create database.** Start in **production mode** (rules are
   provided in this repo — see step 6).
4. **Build → Storage → Get started.** Used only for ordinary profile photos, never biometric data.
5. **Project settings → General → Your apps → Add app → Web.** Copy the config values shown — you
   need these for `.env` in step 4 below.
6. **Project settings → Service accounts → Generate new private key.** Download the JSON — you
   need this for `server/.env` (never commit it).

## 3. Install dependencies

```bash
# Frontend (project root)
npm install

# Backend API
npm install --prefix server

# Cloud Functions
npm install --prefix functions
```

## 4. Configure environment variables

```bash
cp .env.example .env               # frontend
cp server/.env.example server/.env # backend
```

Fill in `.env` with the Web app config from step 2.5 above, and `server/.env` with the project id
and **either** `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the whole downloaded key as one line) **or**
`GOOGLE_APPLICATION_CREDENTIALS` (a path to the key file) — see the comments in
`server/.env.example` for exact formatting. Cloud Functions need no separate env file; Firebase
injects project credentials automatically when deployed.

## 5. Run it locally

```bash
npm run dev            # frontend, http://localhost:5173
npm run server:dev      # backend API, http://localhost:4000  (equivalent: npm run dev --prefix server)
```

Both must be running for attendance actions (create session, self-mark, manual mark, finalize,
lock, corrections, device registration) to work — the frontend calls the backend for all of these.
Everything else (dashboards, browsing directory data, live attendance viewing) reads Firestore
directly and works even if the backend is briefly unreachable, with a clear error toast on the
privileged actions instead of a crash.

## 6. Deploy Firestore rules, indexes, and Storage rules

Install the Firebase CLI once (`npm install -g firebase-tools`), then:

```bash
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 7. Deploy Cloud Functions

```bash
npm run build --prefix functions
firebase deploy --only functions
```

(Scheduled functions require the Blaze plan; the app works without them, just without automatic
low-attendance alerts / stale-session expiry until deployed.)

## 8. Create the first admin account

There is a deliberate bootstrap gap here: **the very first admin can't be created by another
admin, because none exists yet.** One-time manual step:

1. Sign in once through the app's Login page (or Google sign-in) with the account that should be
   the first admin — this creates their Firebase Auth user but no `users/{uid}` Firestore profile
   yet, so they'll see "No profile found for this account."
2. In the Firebase Console → Firestore → `users` collection, create a document with that user's
   **uid** as the document ID, containing:
   ```json
   {
     "userId": "<their uid>",
     "name": "Admin Name",
     "email": "admin@college.edu",
     "role": "admin",
     "status": "active",
     "createdAt": "2026-08-31T00:00:00.000Z"
   }
   ```
3. Sign in again — they now land on the Admin Dashboard and can manage everything else (including
   promoting future admins, once that flow exists in your institution's process) from the UI.

## 9. Set up your first class

From the Admin Dashboard:

1. **Departments** → add a department (e.g. "Computer Science & Engineering").
2. **Classes & Divisions** → add a class (e.g. "B.Tech CSE 2nd Year", divisions `["A", "B"]`), then
   add subjects under it.
3. **Teachers** → add a teacher, assign them to the subject(s) they teach.
4. **Students** → add students to a class/division. (Their login account is created the first time
   they successfully sign in with the matching college email — see `src/features/admin` for the
   exact bootstrap note shown in the Add Student dialog.)
5. **Settings & Policy** → set the college's default GPS coordinates + geofence radius, minimum
   attendance %, and which verification methods are enabled institution-wide.

## 10. Start the first attendance session

As the teacher: **Dashboard → Start Attendance** → pick subject/class/division, date/time, choose
verification methods (e.g. Face + Location, or Manual), then **Start**. Students with an open
session for their division see **Mark Attendance** light up on their dashboard.

## Using it on a phone

The web app is **mobile-first and responsive today** — it works directly in a phone browser, and
the student attendance screen (`/student/attendance`) is deliberately a single-focus, big-button
flow meant to be used quickly in a classroom.

For an **installable Android app** with real native biometrics (`BiometricPrompt`) and stronger
GPS guarantees (mock-location detection), wrap the built frontend with
[Capacitor](https://capacitorjs.com/) — this is a follow-up step, not yet wired into this repo:

```bash
npm install @capacitor/core @capacitor/android
npx cap init                 # app name + id
npm run build                 # produces dist/
npx cap add android
npx cap sync
npx cap open android          # opens Android Studio
```

See [`docs/ANDROID_INTEGRATION.md`](docs/ANDROID_INTEGRATION.md) for exactly which browser-based
stand-ins (`src/features/biometric/webauthn.ts`, `src/features/face/faceVerification.ts`) need to
be swapped for native plugin calls, and why.

## Project structure

```
src/                      Frontend (Vite + React + TS)
  auth/                    Firebase auth context, protected/role routes
  components/ui/           Reusable UI primitives (shadcn-style)
  components/layout/       App shell, sidebar, topnav, theme
  components/common/       StatCard, badges, empty/loading states, confirm dialog
  features/
    admin/                 Department/class/teacher/student/CR management + policy settings
    attendance/             Sessions, live attendance, manual marking, student self-mark flow
    biometric/               WebAuthn interface (web stand-in — see docs/ANDROID_INTEGRATION.md)
    face/                    Face liveness/capture interface (pluggable match strategy)
    geolocation/              Geofence distance + browser geolocation wrapper
    qr/                       QR generation (teacher) + scanning (student)
    reports/                  Filterable reports + CSV/Excel/PDF export
    audit/                    Read-only audit trail viewer
    notifications/            In-app notification center
    settings/                 Privacy Policy + Consent pages
  schemas/                  Zod validation schemas (forms + API payload shapes)
  types/                    Canonical domain types — source of truth for the Firestore schema
server/                   Backend (Express + TS) — the trusted, privileged layer
functions/                Firebase Cloud Functions (triggers + scheduled jobs)
docs/                     Architecture, testing checklist, Android integration notes
firestore.rules, firestore.indexes.json, storage.rules, firebase.json
```

## Security model, in one paragraph

The frontend never decides whether attendance is valid. It collects signals (a scanned QR token, a
GPS reading, a biometric success boolean, a face liveness/confidence pair) and hands them to
`server/`, which independently re-derives geofence distance, re-checks the QR token/expiry,
re-runs the duplicate check inside a Firestore transaction keyed on a deterministic
`{sessionId}_{studentId}` document ID, computes the authoritative risk score, and only then writes
the attendance record and its audit log entry — using the Admin SDK, which Firestore Security
Rules cannot be bypassed by a browser client to imitate.
