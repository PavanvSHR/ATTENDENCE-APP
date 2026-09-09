/** Shape of every response from the server/ Express API (see backend contract). */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * Thrown by `postJson` with a friendly, already-toast-ready message.
 * `code` (when present) mirrors the server's machine-readable error code
 * (e.g. "outside_geofence", "duplicate", "qr_expired") for callers that want
 * to branch on it; `message` is always safe to show directly to the student.
 */
export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * Small fetch helper for server-authoritative attendance actions. Sign-in
 * has been removed app-wide, so this no longer attaches a Firebase ID
 * token — the server/ API's authMiddleware was correspondingly changed to
 * stop requiring one (see server/src/middleware/authMiddleware.ts). Always
 * resolves to friendly, user-facing error strings via `ApiError` instead of
 * throwing raw fetch errors.
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError("Attendance server is not configured yet. Please contact your administrator.");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the attendance server. Check your connection and try again.");
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. a proxy error page) — fall through to the
    // generic status-based message below.
  }

  if (!response.ok || !envelope || !envelope.success) {
    const message = envelope?.error?.message ?? `Something went wrong (${response.status}). Please try again.`;
    throw new ApiError(message, envelope?.error?.code);
  }

  return envelope.data as T;
}
