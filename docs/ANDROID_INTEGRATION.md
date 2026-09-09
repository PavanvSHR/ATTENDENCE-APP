# Android integration (Capacitor path)

This app's web build (`src/features/biometric/webauthn.ts`, `src/features/face/faceVerification.ts`,
`src/features/geolocation/geofence.ts`) is **interface-correct but browser-limited by design** —
each file documents exactly this in its header comments. This note explains precisely what a
browser cannot do, and what native Android API replaces it once the app is wrapped with
[Capacitor](https://capacitorjs.com/) (see README §"Using it on a phone" for the wrap-up commands).

## 1. Biometric verification

- **Web today**: `src/features/biometric/webauthn.ts` uses WebAuthn platform authenticators
  (Windows Hello / Touch ID / an Android browser's fingerprint-unlock-for-web prompt). This proves
  "some platform authenticator on this device said yes" for UX purposes, using a client-generated
  challenge — it is **not** a cryptographically-verifiable assertion the server can check against
  a challenge it issued.
- **Native replacement**: Android's `BiometricPrompt` API via a Capacitor plugin (e.g.
  `capacitor-native-biometric`, or a small custom plugin). Returns a real fingerprint/face-unlock
  UX and a boolean result. Keep the contract identical: only a success/failure boolean crosses the
  bridge — never a template or image (see `AttendanceVerification.biometric` in `src/types`).
- To do this properly end-to-end, also add `POST /webauthn/register` and `POST /webauthn/assert`
  challenge endpoints to `server/` so a real WebAuthn ceremony (or the native plugin's attestation,
  if it supports one) is cryptographically verified server-side, not just trusted client-side.

## 2. Location / mock-GPS detection

- **Web today**: `src/features/geolocation/geofence.ts` uses `navigator.geolocation`. There is
  **no web API** that can tell you whether a location was produced by a fake-GPS app — the
  `mockLocationSuspected` field on `ObservedLocation` is always `undefined` from the browser.
- **Native replacement**: Android's `Location.isFromMockProvider()` (or
  `LocationManagerCompat`/`FusedLocationProviderClient` equivalents) can detect mock-location
  providers directly. Expose this via a small custom Capacitor plugin that returns
  `{ latitude, longitude, accuracy, mockLocationSuspected }` — the shape already matches
  `ObservedLocation`, so no frontend type changes are needed, only the native plugin call
  replacing the `navigator.geolocation` call inside `getCurrentPosition`.

## 3. Face liveness / anti-spoofing

- **Web today**: `src/features/face/faceVerification.ts` implements real camera access
  (`getUserMedia`) and a real multi-frame liveness-cue capture sequence, but its default
  `matchStrategy` (`placeholderMatchStrategy`) always fails closed — no ML model is wired in. This
  is intentional: shipping an optimistic "always pass" placeholder would recreate exactly the
  proxy-attendance hole (a held-up photo marking someone present) this whole app exists to close.
- **Native replacement**: Android CameraX + ML Kit Face Detection (or a vendor liveness/anti-spoof
  SDK) gives access to depth/IR sensors on supported devices and much stronger anti-spoofing
  signal than a browser `<video>` element can ever provide. Swap `placeholderMatchStrategy` for a
  `MatchStrategy` that calls into the native layer via a Capacitor plugin, following the exact
  liveness-then-match order documented in the file: verify frames differ frame-to-frame (or trust
  the native SDK's own liveness signal) **before** attempting a match, and return a real 0–1
  `matchConfidence`, never a hardcoded `1`.

## 4. App/device integrity

- Not implemented in this build at all — there is no web equivalent. Recommend Google's
  [Play Integrity API](https://developer.android.com/google/play/integrity) once native-wrapped,
  to detect rooted devices, emulators, or a tampered APK before trusting its biometric/face/location
  signals. This would plug in as an additional signal into the server's risk-scoring step
  (`server/src/services/riskService.ts`), not as a hard gate — consistent with the app's existing
  "flag, don't silently punish" risk-scoring philosophy.

## Summary

| Capability | Web (today) | Native Android (once wrapped) |
|---|---|---|
| Biometric | WebAuthn platform authenticator (UX proof only) | `BiometricPrompt` via Capacitor plugin |
| Location | Browser Geolocation API | `FusedLocationProviderClient` + `isFromMockProvider()` |
| Face liveness/match | Real camera capture, **no model wired in** (fails closed) | CameraX + ML Kit / vendor SDK |
| Device/app integrity | None | Play Integrity API |

None of the above requires changing the server API contract or the Firestore schema — only the
implementation inside `src/features/biometric/`, `src/features/face/`, and
`src/features/geolocation/` swaps from a browser API call to a Capacitor plugin call, since both
sides already agree on the same boolean/confidence-only payload shapes.
