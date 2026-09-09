/**
 * ============================================================================
 * Web biometric verification — READ BEFORE MODIFYING
 * ============================================================================
 * On the web, "biometric verification" is inherently limited to whatever the
 * OS/browser exposes through WebAuthn *platform authenticators* (Windows
 * Hello, Touch ID, Android fingerprint-unlock-for-the-browser, etc). This is
 * a boolean "did the platform authenticator succeed" signal — it is NOT a
 * true first-class fingerprint/face-unlock capture flow. That experience
 * requires the native Android path via `BiometricPrompt` (Capacitor plugin),
 * which is being built elsewhere.
 *
 * A *real* WebAuthn ceremony (registration + assertion) needs a
 * server-generated, single-use challenge from `POST /webauthn/*` endpoints.
 * Those may not exist yet (another agent owns `server/`), so `verifyBiometric`
 * below is a best-effort STAND-IN: it runs a `navigator.credentials.get()`
 * assertion against a client-generated challenge. This proves "some platform
 * authenticator on this device said yes" for UX purposes; it is NOT a
 * cryptographically-verifiable proof to the server (the server cannot check
 * a signature against a challenge it never issued). Replace with a real
 * challenge/response ceremony against `POST /webauthn/*` once available.
 *
 * PRIVACY: never store or transmit any raw biometric image/template — only
 * the boolean success result, matching `AttendanceVerification.biometric`
 * (`VerificationResult`, not raw biometric data).
 * ============================================================================
 */

/** Whether this device/browser can even attempt platform-authenticator biometrics. */
export async function isWebAuthnAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      return false;
    }
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Message required by spec — surface this string directly to the student when unavailable. */
export const BIOMETRIC_UNAVAILABLE_MESSAGE = "Biometric authentication is not available on this device.";

/**
 * Attempts a platform-authenticator WebAuthn assertion as a stand-in for a
 * true enrolled biometric check. Resolves `{success:false}` (rather than
 * throwing) for a user cancellation or failed assertion, so the caller can
 * decide how to proceed with the attendance flow; throws only when biometric
 * verification isn't available on this device at all.
 */
export async function verifyBiometric(): Promise<{ success: boolean }> {
  const available = await isWebAuthnAvailable();
  if (!available) {
    throw new Error(BIOMETRIC_UNAVAILABLE_MESSAGE);
  }

  try {
    // No server-issued challenge is assumed to exist yet — see file header.
    // A random client-side challenge lets the platform authenticator prompt
    // run, but carries no server-verifiable meaning by itself.
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      mediation: "required",
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
      },
    });

    return { success: assertion != null };
  } catch {
    // Cancelled, no enrolled platform authenticator, or otherwise failed —
    // report this as a plain "not verified" rather than throwing, so a
    // legitimate student isn't hard-blocked by a UX hiccup; the server
    // makes the real accept/reject call.
    return { success: false };
  }
}
