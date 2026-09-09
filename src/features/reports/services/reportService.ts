/**
 * Report data-fetching. Firestore does not let us combine an arbitrary mix
 * of equality filters (class/division/subject/teacher) with a date range
 * without pre-built composite indexes, so the strategy here is deliberately
 * simple and robust: query `attendanceSessions` constrained only by the date
 * range (a single-field range + orderBy needs no composite index), apply the
 * remaining equality filters in-memory, then fetch each matching session's
 * records in parallel and flatten/filter in-memory too. This trades a few
 * extra reads for queries that always work without index setup.
 */
import { getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { recordsCol, sessionsCol, teachersCol } from "@/firebase/firestore";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  AttendanceVerification,
  RiskLevel,
} from "@/types";

export interface ReportFilters {
  classId?: string;
  divisionId?: string;
  subjectId?: string;
  teacherId?: string;
  status?: AttendanceStatus;
  from?: string; // ISO date (yyyy-mm-dd), inclusive
  to?: string; // ISO date (yyyy-mm-dd), inclusive
}

/** One flattened attendance-record-plus-session row, ready for tables/exports. */
export interface ReportRow {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  divisionId: string;
  date: string;
  status: AttendanceStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  flaggedForReview: boolean;
  verification: AttendanceVerification;
  timestamp: string;
  reason?: string;
}

export interface DefaulterRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  divisionId: string;
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  /** Percentage of sessions attended (present + late counted as attended). */
  percentage: number;
}

/** Resolves the `teachers/{teacherId}` doc id for a logged-in user's uid, if any. */
export async function resolveTeacherId(userId: string): Promise<string | undefined> {
  const snap = await getDocs(query(teachersCol, where("userId", "==", userId), limit(1)));
  return snap.docs[0]?.data().teacherId;
}

async function getFilteredSessions(filters: ReportFilters): Promise<AttendanceSession[]> {
  const clauses = [];
  if (filters.from) clauses.push(where("date", ">=", filters.from));
  if (filters.to) clauses.push(where("date", "<=", filters.to));
  clauses.push(orderBy("date", "desc"));

  const snap = await getDocs(query(sessionsCol, ...clauses));
  let sessions = snap.docs.map((d) => d.data());

  if (filters.classId) sessions = sessions.filter((s) => s.classId === filters.classId);
  if (filters.divisionId) sessions = sessions.filter((s) => s.divisionId === filters.divisionId);
  if (filters.subjectId) sessions = sessions.filter((s) => s.subjectId === filters.subjectId);
  if (filters.teacherId) sessions = sessions.filter((s) => s.teacherId === filters.teacherId);

  return sessions;
}

function toRow(record: AttendanceRecord, session: AttendanceSession): ReportRow {
  return {
    recordId: record.recordId,
    sessionId: session.sessionId,
    studentId: record.studentId,
    studentName: record.studentName,
    rollNumber: record.rollNumber,
    subjectId: session.subjectId,
    subjectName: session.subjectName,
    teacherId: session.teacherId,
    teacherName: session.teacherName,
    classId: session.classId,
    divisionId: session.divisionId,
    date: session.date,
    status: record.status,
    riskScore: record.riskScore,
    riskLevel: record.riskLevel,
    flaggedForReview: record.flaggedForReview,
    verification: record.verification,
    timestamp: record.timestamp,
    reason: record.reason,
  };
}

/** Fetches every attendance record for the given sessions, flattened into report rows. */
async function buildRows(
  sessions: AttendanceSession[],
  opts?: { statusFilter?: AttendanceStatus; studentId?: string }
): Promise<ReportRow[]> {
  const perSession = await Promise.all(
    sessions.map(async (session) => {
      const snap = await getDocs(query(recordsCol, where("sessionId", "==", session.sessionId)));
      return snap.docs.map((d) => toRow(d.data(), session));
    })
  );

  let rows = perSession.flat();
  if (opts?.statusFilter) rows = rows.filter((r) => r.status === opts.statusFilter);
  if (opts?.studentId) rows = rows.filter((r) => r.studentId === opts.studentId);

  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** All attendance records for a single calendar date, optionally narrowed further. */
export async function fetchDailyAttendance(date: string, filters: ReportFilters = {}): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions({ ...filters, from: date, to: date });
  return buildRows(sessions, { statusFilter: filters.status });
}

/** All attendance records within a month ("YYYY-MM"), optionally narrowed further. */
export async function fetchMonthlyAttendance(month: string, filters: ReportFilters = {}): Promise<ReportRow[]> {
  const from = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const sessions = await getFilteredSessions({ ...filters, from, to });
  return buildRows(sessions, { statusFilter: filters.status });
}

/** Full attendance history for one student, optionally narrowed by date range/other filters. */
export async function fetchStudentAttendance(studentId: string, filters: ReportFilters = {}): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions(filters);
  return buildRows(sessions, { statusFilter: filters.status, studentId });
}

/** Attendance across all sessions of a subject, optionally narrowed further. */
export async function fetchSubjectAttendance(subjectId: string, filters: ReportFilters = {}): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions({ ...filters, subjectId });
  return buildRows(sessions, { statusFilter: filters.status });
}

/** Attendance across all sessions of a class (and optional division), narrowed further. */
export async function fetchClassAttendance(
  classId: string,
  divisionId: string | undefined,
  filters: ReportFilters = {}
): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions({ ...filters, classId, divisionId });
  return buildRows(sessions, { statusFilter: filters.status });
}

/**
 * Students whose overall attendance percentage (present + late counted as
 * attended) falls below `thresholdPercent`, aggregated across the sessions
 * matched by `filters`.
 */
export async function fetchDefaultersList(
  thresholdPercent: number,
  filters: ReportFilters = {}
): Promise<DefaulterRow[]> {
  const sessions = await getFilteredSessions(filters);
  const rows = await buildRows(sessions);

  const byStudent = new Map<string, DefaulterRow>();
  for (const r of rows) {
    let entry = byStudent.get(r.studentId);
    if (!entry) {
      entry = {
        studentId: r.studentId,
        studentName: r.studentName,
        rollNumber: r.rollNumber,
        classId: r.classId,
        divisionId: r.divisionId,
        totalSessions: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        percentage: 0,
      };
      byStudent.set(r.studentId, entry);
    }
    entry.totalSessions += 1;
    if (r.status === "present") entry.presentCount += 1;
    else if (r.status === "late") entry.lateCount += 1;
    else if (r.status === "absent") entry.absentCount += 1;
    else if (r.status === "excused") entry.excusedCount += 1;
  }

  const defaulters: DefaulterRow[] = [];
  for (const entry of byStudent.values()) {
    const attended = entry.presentCount + entry.lateCount;
    entry.percentage = entry.totalSessions > 0 ? Math.round((attended / entry.totalSessions) * 1000) / 10 : 0;
    if (entry.percentage < thresholdPercent) defaulters.push(entry);
  }

  return defaulters.sort((a, b) => a.percentage - b.percentage);
}

/** All records marked "late" within the matched sessions. */
export async function fetchLateAttendance(filters: ReportFilters = {}): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions(filters);
  const rows = await buildRows(sessions);
  return rows.filter((r) => r.status === "late");
}

function hasVerificationFailure(verification: AttendanceVerification): boolean {
  return (
    verification.biometric === "failed" ||
    verification.face === "failed" ||
    verification.location === "failed" ||
    verification.qr === "failed"
  );
}

/** Records where any verification method (biometric/face/location/qr) failed. */
export async function fetchVerificationFailures(filters: ReportFilters = {}): Promise<ReportRow[]> {
  const sessions = await getFilteredSessions(filters);
  const rows = await buildRows(sessions);
  return rows.filter((r) => hasVerificationFailure(r.verification));
}
