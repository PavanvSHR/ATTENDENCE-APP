import { doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { sessionsCol, recordsCol, studentsCol } from "@/firebase/firestore";
import type {
  AttendanceRecord,
  AttendanceSession,
  RegisteredDevice,
  StudentRecord,
  SubjectAttendanceSummary,
} from "@/types";
import type { SelfAttendanceAttemptInput } from "@/schemas/attendance.schema";
import { postJson } from "./apiClient";

/** Today's date as an ISO `YYYY-MM-DD` string, matching `AttendanceSession.date`. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Live-subscribes to today's attendance sessions for a student's division
 * (across all statuses — draft/open/finalized/etc — so the dashboard can show
 * a full timetable; callers that only care about sessions a student can
 * currently act on should filter for `status === "open"`).
 *
 * NOTE: this query (divisionId + date, ordered by startTime) may require a
 * Firestore composite index — Firestore's error message links directly to
 * the console page to create it if one is missing.
 */
export function subscribeToTodaysSessions(
  divisionId: string,
  onChange: (sessions: AttendanceSession[]) => void
) {
  const q = query(
    sessionsCol,
    where("divisionId", "==", divisionId),
    where("date", "==", todayIso()),
    orderBy("startTime", "asc")
  );
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data())));
}

/** Live-subscribes to a student's own attendance records, most recent first. */
export function subscribeToMyAttendanceRecords(
  studentId: string,
  onChange: (records: AttendanceRecord[]) => void,
  max = 500
) {
  const q = query(recordsCol, where("studentId", "==", studentId), orderBy("timestamp", "desc"), limit(max));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data())));
}

/**
 * Live-subscribes to the current user's own `StudentRecord` doc (looked up by
 * `userId`, since the student doc id is `studentId`, not the auth uid).
 * Needed for roll/class/division display and `registeredDeviceIds`.
 */
export function subscribeToMyStudentRecord(
  userId: string,
  onChange: (student: StudentRecord | null) => void
) {
  const q = query(studentsCol, where("userId", "==", userId), limit(1));
  return onSnapshot(q, (snap) => onChange(snap.empty ? null : snap.docs[0].data()));
}

/**
 * Submits a self-attendance attempt. The server independently re-verifies
 * everything here (geofence distance, QR validity, duplicate check, risk
 * score) — this call only reports what the client observed; errors surface
 * as `ApiError` with a human-readable `message` from the server (or a
 * friendly local fallback if the server is unreachable).
 */
export async function submitSelfAttendance(payload: SelfAttendanceAttemptInput): Promise<AttendanceRecord> {
  return postJson<AttendanceRecord>("/attendance/self", payload);
}

/**
 * Registers (or re-confirms) the current device for the signed-in student.
 * The first device on an account is auto-verified; later ones may come back
 * `status:"pending"`, meaning extra scrutiny rather than a hard block.
 */
export async function registerDevice(label: string, platform: RegisteredDevice["platform"]): Promise<RegisteredDevice> {
  return postJson<RegisteredDevice>("/devices/register", { label, platform });
}

/**
 * Aggregates a student's own attendance records by subject, client-side.
 * Fine to do in-memory: a single student's record set is small. Each record
 * only stores `sessionId`, so subjects are resolved by joining against the
 * (deduplicated) set of sessions those records belong to.
 *
 * Attendance convention used here: `present` and `late` both count toward
 * the numerator (a late arrival is still an attended class); `absent` and
 * `excused` do not. This mirrors typical attendance-percent policy but is a
 * client-side display convenience only — authoritative reporting lives in
 * the admin/reports module.
 */
export async function getSubjectAttendanceSummary(studentId: string): Promise<SubjectAttendanceSummary[]> {
  const recordsSnap = await getDocs(query(recordsCol, where("studentId", "==", studentId)));
  const records = recordsSnap.docs.map((d) => d.data());
  if (records.length === 0) return [];

  const sessionIds = Array.from(new Set(records.map((r) => r.sessionId)));
  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const snap = await getDoc(doc(sessionsCol, sessionId));
      return snap.exists() ? snap.data() : null;
    })
  );
  const sessionById = new Map(
    sessions.filter((s): s is AttendanceSession => s !== null).map((s) => [s.sessionId, s])
  );

  const bySubject = new Map<string, SubjectAttendanceSummary>();
  for (const record of records) {
    const session = sessionById.get(record.sessionId);
    if (!session) continue; // session was deleted or unreadable; skip rather than misattribute

    const existing = bySubject.get(session.subjectId) ?? {
      subjectId: session.subjectId,
      subjectName: session.subjectName,
      present: 0,
      total: 0,
      percentage: 0,
    };

    existing.total += 1;
    if (record.status === "present" || record.status === "late") existing.present += 1;

    bySubject.set(session.subjectId, existing);
  }

  return Array.from(bySubject.values())
    .map((s) => ({ ...s, percentage: s.total > 0 ? Math.round((s.present / s.total) * 1000) / 10 : 0 }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}
