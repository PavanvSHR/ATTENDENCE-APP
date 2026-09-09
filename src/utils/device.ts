/**
 * Device identity helper for the student attendance flow.
 *
 * IMPORTANT — this is a *convenience* identifier, NOT a security boundary.
 * It is a random UUID persisted in `localStorage`. A student (or anyone with
 * access to the browser's dev tools) can clear it, copy it between browsers,
 * or fabricate a new one at will — `localStorage` offers zero tamper-proofing.
 *
 * That is precisely why the backend never trusts this value on its own: an
 * unrecognized/unregistered `deviceId` is treated as elevated risk (see
 * `POST /devices/register` — new devices may come back `status:"pending"`
 * for extra scrutiny) rather than as proof of who is submitting attendance.
 * Real device trust, if ever needed, would require an attested/hardware-
 * backed identifier (e.g. via a native app), which is out of scope here.
 */

const DEVICE_ID_STORAGE_KEY = "attendance_device_id";

/**
 * Reads the device id from `localStorage`, creating and persisting a new
 * random UUID the first time it's called on a given browser/profile.
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage can throw in private-browsing modes or when disabled.
    // Fall back to a session-only id so the flow can still proceed —
    // the backend will simply treat this as an unrecognized device.
    return crypto.randomUUID();
  }
}
