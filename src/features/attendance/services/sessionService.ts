/**
 * Attendance session + record access for the teacher module.
 *
 * Privileged writes (create/finalize/lock a session, manual marking,
 * corrections) go through the server/ API via `postJson` so the backend
 * stays the source of truth for validation, risk scoring, and audit
 * logging. Live reads (watching a session and its records update in real
 * time) go straight to Firestore with `onSnapshot` — that's what powers
 * the "teacher sees live attendance" requirement without depending on the
 * backend being reachable.
 */
import { doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { recordsCol, sessionsCol } from "@/firebase/firestore";
import type { AttendanceRecord, AttendanceSession } from "@/types";
import type { CorrectionInput, CreateSessionInput, ManualAttendanceBatchInput } from "@/schemas/attendance.schema";
import { ApiError, postJson } from "./apiClient";

export interface CreateSessionPayload extends CreateSessionInput {
  teacherId: string;
  teacherName: string;
  subjectName: string;
}

export type ApiResult<T> = { success: true; data: T } | { success: false; error: { code?: string; message: string } };

/**
 * Adapts apiClient's throw-on-failure `postJson` into a result object so
 * callers (pages/components) can branch on `.success` and toast `.error`
 * without try/catch scattered everywhere — the whole point being that a
 * still-under-construction backend degrades to a friendly toast, not a
 * crashed page.
 */
async function callApi<T>(path: string, body: unknown = {}): Promise<ApiResult<T>> {
  try {
    const data = await postJson<T>(path, body);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: { code: err.code, message: err.message } };
    return { success: false, error: { message: "Something went wrong. Please try again." } };
  }
}

/** Creates a session server-side (validates teacher owns the subject, opens it, issues a QR token if requested). */
export function createSession(payload: CreateSessionPayload) {
  return callApi<AttendanceSession>("/sessions", payload);
}

/** Rotates the QR token/expiry shortly before it lapses — call on a timer while the QR modal is open. */
export function rotateQr(sessionId: string) {
  return callApi<{ qrToken: string; qrExpiresAt: string }>(`/sessions/${sessionId}/qr/rotate`);
}

/** Finalizes a session (teacher only, own session). */
export function finalizeSession(sessionId: string) {
  return callApi<AttendanceSession>(`/sessions/${sessionId}/finalize`);
}

/** Locks a session — irreversible; further changes require a correction with a reason. */
export function lockSession(sessionId: string) {
  return callApi<AttendanceSession>(`/sessions/${sessionId}/lock`);
}

/** Batch-records manual attendance entries; rejected server-side if the session is locked. */
export function markManualAttendance(payload: ManualAttendanceBatchInput) {
  return callApi<AttendanceRecord[]>("/attendance/manual", payload);
}

/** Corrects a single attendance record; requires a reason and writes an audit log entry server-side. */
export function correctAttendance(payload: CorrectionInput) {
  return callApi<AttendanceRecord>(`/attendance/${payload.recordId}/correct`, payload);
}

/** Live-subscribes to a single session document. Calls back with `null` if the session doesn't exist. */
export function subscribeToSession(sessionId: string, onChange: (session: AttendanceSession | null) => void) {
  return onSnapshot(
    doc(sessionsCol, sessionId),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    () => onChange(null)
  );
}

/** Live-subscribes to every attendance record for a session, sorted oldest-first by timestamp. */
export function subscribeToSessionRecords(sessionId: string, onChange: (records: AttendanceRecord[]) => void) {
  // Equality-only filter (no orderBy) so this doesn't depend on a composite
  // Firestore index existing; records are sorted client-side instead.
  const q = query(recordsCol, where("sessionId", "==", sessionId));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => d.data());
      records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      onChange(records);
    },
    () => onChange([])
  );
}

/** One-off fetch of a teacher's most recent sessions (newest first), for dashboards. */
export async function listTeacherSessions(teacherId: string, max = 20): Promise<AttendanceSession[]> {
  const q = query(sessionsCol, where("teacherId", "==", teacherId), limit(max));
  const snap = await getDocs(q);
  const sessions = snap.docs.map((d) => d.data());
  sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sessions;
}
