import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, StudentRecord, SubjectAttendanceSummary } from "@/types";
import {
  getSubjectAttendanceSummary,
  subscribeToMyAttendanceRecords,
  subscribeToMyStudentRecord,
  subscribeToTodaysSessions,
} from "../services/studentAttendanceService";

export interface StudentAttendanceViewModel {
  loading: boolean;
  /** null once loaded if no `students/{..}` doc was found for this account. */
  studentRecord: StudentRecord | null;
  todaysSessions: AttendanceSession[];
  /** Today's sessions with `status === "open"` — what the attendance screen can act on right now. */
  openSessions: AttendanceSession[];
  myRecords: AttendanceRecord[];
  subjectSummaries: SubjectAttendanceSummary[];
  /** Overall attendance percentage across all subjects (present+late / total), 0 if no records yet. */
  overallPercentage: number;
  overallPresent: number;
  overallTotal: number;
  statusCounts: Record<AttendanceStatus, number>;
  /** sessionIds (today only) the student already has a record for. */
  todaysMarkedSessionIds: Set<string>;
}

const EMPTY_STATUS_COUNTS: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };

/**
 * Combines today's sessions, the student's own records, and per-subject
 * summaries into a single view model for the student dashboard. Reads the
 * signed-in student from `useAuth()` — no params needed.
 */
export function useStudentAttendance(): StudentAttendanceViewModel {
  const { profile } = useAuth();
  const userId = profile?.userId;

  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(null);
  const [studentLoaded, setStudentLoaded] = useState(false);
  const [todaysSessions, setTodaysSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectAttendanceSummary[]>([]);

  useEffect(() => {
    if (!userId) {
      setStudentRecord(null);
      setStudentLoaded(true);
      return;
    }
    setStudentLoaded(false);
    const unsubscribe = subscribeToMyStudentRecord(userId, (student) => {
      setStudentRecord(student);
      setStudentLoaded(true);
    });
    return unsubscribe;
  }, [userId]);

  const divisionId = studentRecord?.divisionId;

  useEffect(() => {
    if (!divisionId) {
      setTodaysSessions([]);
      setSessionsLoaded(true);
      return;
    }
    setSessionsLoaded(false);
    const unsubscribe = subscribeToTodaysSessions(divisionId, (sessions) => {
      setTodaysSessions(sessions);
      setSessionsLoaded(true);
    });
    return unsubscribe;
  }, [divisionId]);

  const studentId = studentRecord?.studentId;

  useEffect(() => {
    if (!studentId) {
      setMyRecords([]);
      setRecordsLoaded(true);
      return;
    }
    setRecordsLoaded(false);
    const unsubscribe = subscribeToMyAttendanceRecords(studentId, (records) => {
      setMyRecords(records);
      setRecordsLoaded(true);
    });
    return unsubscribe;
  }, [studentId]);

  // Recompute the subject-wise summary whenever the record set changes.
  useEffect(() => {
    if (!studentId) {
      setSubjectSummaries([]);
      return;
    }
    let cancelled = false;
    getSubjectAttendanceSummary(studentId)
      .then((summaries) => {
        if (!cancelled) setSubjectSummaries(summaries);
      })
      .catch(() => {
        if (!cancelled) setSubjectSummaries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, myRecords]);

  const openSessions = useMemo(() => todaysSessions.filter((s) => s.status === "open"), [todaysSessions]);

  const statusCounts = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { ...EMPTY_STATUS_COUNTS };
    for (const record of myRecords) counts[record.status] += 1;
    return counts;
  }, [myRecords]);

  const { overallPresent, overallTotal, overallPercentage } = useMemo(() => {
    const present = subjectSummaries.reduce((sum, s) => sum + s.present, 0);
    const total = subjectSummaries.reduce((sum, s) => sum + s.total, 0);
    return {
      overallPresent: present,
      overallTotal: total,
      overallPercentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    };
  }, [subjectSummaries]);

  const todaysMarkedSessionIds = useMemo(() => {
    const todaysIds = new Set(todaysSessions.map((s) => s.sessionId));
    return new Set(myRecords.filter((r) => todaysIds.has(r.sessionId)).map((r) => r.sessionId));
  }, [todaysSessions, myRecords]);

  return {
    loading: !studentLoaded || !sessionsLoaded || !recordsLoaded,
    studentRecord,
    todaysSessions,
    openSessions,
    myRecords,
    subjectSummaries,
    overallPercentage,
    overallPresent,
    overallTotal,
    statusCounts,
    todaysMarkedSessionIds,
  };
}
