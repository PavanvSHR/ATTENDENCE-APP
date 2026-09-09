# Architecture

## Firestore schema

Canonical field-level types live in [`src/types/index.ts`](../src/types/index.ts) (frontend) and
are mirrored by hand in [`server/src/types/index.ts`](../server/src/types/index.ts) (backend, a
separate npm package). Top-level collections:

| Collection | Written by | Read by | Notes |
|---|---|---|---|
| `users` | Auth bootstrap (manual for the first admin, see README §8) + admin | self (own doc), server | `role`/`status` here is the **sole source of authorization truth** |
| `students` | admin (client), server (device registration, arrays) | admin, teacher (their classes), self, server | `registeredDeviceIds` mutated only server-side |
| `teachers` | admin | admin, server | |
| `departments` / `classes` / `divisions` / `subjects` | admin | everyone (read) | academic directory |
| `attendanceSessions` | **server only** (`POST /sessions`) | everyone (read, scoped) | client cannot create/mutate directly |
| `attendanceRecords` | **server only** | scoped reads (own record for students; teacher's sessions; admin all) | deterministic doc id `{sessionId}_{studentId}` |
| `auditLogs` | **server + Cloud Functions only** | admin (read) | append-only; no client update/delete path exists |
| `notifications` | server + Cloud Functions (+ narrow client self-notify) | owner only | client may mark-read (`read` field only) |
| `devices` | **server only** (`POST /devices/register`, and inline bootstrap in `POST /attendance/self`) | owner, admin | |
| `settings/attendancePolicy` | admin (client) | everyone (read) | single document, `AttendancePolicy` shape |

See [`firestore.rules`](../firestore.rules) for the enforced version of this table.

## Verification pipeline (`POST /api/attendance/self`)

Implemented in [`server/src/routes/attendance.ts`](../server/src/routes/attendance.ts). Runs in
order, short-circuiting on the first hard failure with a specific `{code, message}` the frontend
shows verbatim to the student:

```
Student authenticated (Firebase ID token verified, role=student)
  → Load session; reject if not "open" or outside its time window       [session_closed]
  → Duplicate pre-check on deterministic doc {sessionId}_{studentId}    [duplicate]
  → QR: token matches + not expired (if "qr" required)                 [qr_expired]
  → Location: haversine distance vs session.location/radiusMeters       [outside_geofence]
      (low accuracy / mock-location-suspected → risk factor, not a hard reject)
  → Biometric: client-reported assertion.success === true (if required) [biometric_failed]
  → Face: liveness passed AND matchConfidence >= policy.faceMatchThreshold (if required) [face_failed]
  → Device check: unrecognized device → NOT hard-blocked; flagged + risk penalty
      (first device ever → auto-registered "verified")
  → Rapid multi-student same-device heuristic (soft signal only)
  → Risk score computed (0–100) → riskLevel low/suspicious/high
      high → flaggedForReview: true, notifies the session's teacher — attendance is still recorded
  → Firestore transaction: re-check duplicate, write record + audit log + student notification
```

The **transaction re-check** (not just the earlier pre-check) is what actually prevents two
concurrent requests from both succeeding — see `docs/TESTING.md` §"Multiple simultaneous
requests".

## REST API contract (`server/`)

Base path `/api`. Every route except `/health` requires `Authorization: Bearer <Firebase ID
token>`. Every response is `{ success, data?, error?: { code, message } }`.

| Method & path | Role | Purpose |
|---|---|---|
| `GET /health` | — | liveness check |
| `POST /sessions` | teacher, cr, admin | create a session; resolves location defaults + issues QR token server-side |
| `POST /sessions/:id/qr/rotate` | teacher, cr, admin (owner/admin) | refresh QR token + expiry |
| `POST /sessions/:id/finalize` | teacher, cr, admin (owner/admin) | open → finalized |
| `POST /sessions/:id/lock` | teacher, admin (owner/admin) | finalized → locked (irreversible) |
| `POST /attendance/manual` | teacher, cr, admin | batch mark/correct a roster; rejects if session locked |
| `POST /attendance/self` | student | the verification pipeline above |
| `POST /attendance/:id/correct` | teacher, admin | single-record correction, reason required |
| `POST /devices/register` | student | explicit device registration (first device auto-verified) |

## Cloud Functions (`functions/`)

- `onAttendanceRecordWrite` — notifies the student on a new record; notifies the session's teacher
  when `riskLevel === "high"` / `flaggedForReview`.
- `onSessionStatusChange` — notifies the division's students when a session opens/closes.
- `lowAttendanceCheck` (scheduled, daily) — compares each student's computed percentage against
  `settings/attendancePolicy.minAttendancePercent`, notifies those below it.
- `expireOpenSessions` (scheduled, every 15 min) — flips stale `"open"` sessions past their end
  time to `"expired"`.

## Why the frontend never decides pass/fail

Every field that determines whether attendance counts — geofence distance, biometric/face verdict,
duplicate status, risk score, session state — is recomputed or authoritatively decided in
`server/`, which uses the Firebase Admin SDK (bypasses Firestore Security Rules). The rules file
then denies the browser client any direct write path to `attendanceRecords`, `attendanceSessions`,
or `auditLogs`, so there is no way to "just call Firestore directly" to forge a result even with a
modified client.
