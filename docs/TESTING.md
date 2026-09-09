# Manual QA checklist

No automated test suite is included yet; this checklist documents the scenarios the architecture
is designed to satisfy, with the expected outcome and where in the code it's enforced. Use it as
both a manual pass and a spec for future automated tests.

| # | Scenario | Steps | Expected result | Enforced in |
|---|---|---|---|---|
| 1 | Correct login | Sign in with valid email/password | Redirected to role home (`/admin`, `/teacher`, or `/student`) | `src/auth/AuthContext.tsx`, `src/pages/LoginPage.tsx` |
| 2 | Wrong password | Sign in with a valid email, wrong password | Generic "Invalid email or password" — no user-enumeration hint | `LoginPage.tsx` |
| 3 | Unauthorized role | A student navigates directly to `/admin/...` | Redirected to `/unauthorized` | `src/auth/RoleRoute.tsx` (UX only — real enforcement is #14) |
| 4 | Student inside geofence | Self-mark attendance for a "location" session while within `radiusMeters` | Accepted, `verification.location = "success"` | `server/src/routes/attendance.ts` step 4 |
| 5 | Student outside geofence | Self-mark from outside the radius | Rejected: "Attendance cannot be marked because you are outside the allowed attendance location." (`outside_geofence`) | same |
| 6 | Duplicate attendance | Submit `POST /attendance/self` twice for the same session | Second attempt rejected 409 `duplicate`; `DUPLICATE_ATTEMPT` audit entry written | pre-check + transaction re-check in `attendance.ts` |
| 7 | Expired session | Self-mark after `endTime` + grace, or against a non-`"open"` session | Rejected `session_closed` | `attendance.ts` step 1 |
| 8 | Biometric failure | Submit with `biometricAssertion.success = false` (or omitted) on a "biometric" session | Rejected `biometric_failed`; `BIOMETRIC_FAILED` audit entry | `attendance.ts` step 5 |
| 9 | Face verification failure | Submit with `faceVerification.livenessPassed = false` or confidence below `policy.faceMatchThreshold` | Rejected `face_failed`; `FACE_FAILED` audit entry | `attendance.ts` step 6 — note the default `placeholderMatchStrategy` in `src/features/face/faceVerification.ts` always fails closed until a real model is wired in, so this is the expected default outcome in this build |
| 10 | Manual attendance | Teacher marks a student present via `ManualAttendanceList` | Record created, `markedBy`/`markedByRole`/`method:"manual"` set, `TEACHER_MARKED_PRESENT` audit entry | `attendance.ts` `/manual` |
| 11 | Teacher correction | Teacher changes an existing record's status | Requires no extra reason via the manual grid (reason required only when overwriting an *existing* record — enforced client-side in `ManualAttendanceList` and server-side via `reason_required` 400) | `attendance.ts` `/manual`, `ManualAttendanceList.tsx` |
| 12 | CR correction limits | CR attempts `POST /attendance/:id/correct` | 403 — endpoint is `requireRole("teacher","admin")` only, CR excluded by design | `attendance.ts` `/:recordId/correct` |
| 13 | Locked session modification | Attempt manual marking or non-admin correction on a `"locked"` session | Manual: 409 `session_locked`. Correction: 403 `session_locked` unless caller is admin | `attendance.ts` |
| 14 | Unauthorized Firestore access | A student's browser attempts a direct Firestore `create` on `attendanceRecords` (bypassing `server/`) | Denied by `firestore.rules` — that collection has no client `create`/`update` allow rule | `firestore.rules` |
| 15 | Multiple simultaneous requests | Fire two concurrent `POST /attendance/self` for the same student+session (e.g. double-tap, or a scripted race) | Exactly one succeeds; the other gets 409 `duplicate` | `db.runTransaction` re-check keyed on the deterministic `{sessionId}_{studentId}` doc id in `attendance.ts` |

## Additional checks worth doing before go-live

- **Account disabled mid-session**: set a user's `users/{uid}.status` to `"disabled"` while they
  have an active browser session — `AuthContext.tsx` signs them out on the next auth-state refresh
  and `authMiddleware.ts` rejects their API calls with `account_inactive`.
- **New/unrecognized device**: register a second device for a student, then self-mark from a third,
  unregistered `deviceId` — attendance is still recorded (per spec, never a silent hard block) but
  `flaggedForReview: true` and a `DEVICE_REJECTED` audit entry are written; verify it surfaces in
  the Audit Log page.
- **QR expiry**: let a displayed QR sit past `qrExpiresAt` without scanning — `QRSessionModal`
  should auto-rotate before expiry in the teacher UI; a stale/reused QR submitted by a student
  should be rejected `qr_expired`.
- **Rate limiting**: hammer `POST /attendance/self` more than 10×/minute from one account — expect
  429 `rate_limited` (`server/src/middleware/rateLimiter.ts`).
