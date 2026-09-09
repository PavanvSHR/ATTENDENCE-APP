/**
 * Combines the live session doc, its live attendance records, and the
 * division's student roster into one view model: a per-student row (student
 * info + their record, if any) plus status counts. This is what powers both
 * the Live tab and the Manual tab on LiveSessionPage.
 */
import { useEffect, useMemo, useState } from "react";
import { useDivisionStudents } from "@/features/classes/hooks/useClassOptions";
import type { AttendanceRecord, AttendanceSession, StudentRecord } from "@/types";
import { subscribeToSession, subscribeToSessionRecords } from "../services/sessionService";

export interface AttendanceSessionRow {
  student: StudentRecord;
  record: AttendanceRecord | null;
}

export interface AttendanceCounts {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
}

export interface AttendanceSessionViewModel {
  session: AttendanceSession | null;
  records: AttendanceRecord[];
  rows: AttendanceSessionRow[];
  counts: AttendanceCounts;
  loading: boolean;
}

export function useAttendanceSession(sessionId: string | undefined): AttendanceSessionViewModel {
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setSessionLoading(false);
      return;
    }
    setSessionLoading(true);
    const unsubscribe = subscribeToSession(sessionId, (s) => {
      setSession(s);
      setSessionLoading(false);
    });
    return unsubscribe;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    const unsubscribe = subscribeToSessionRecords(sessionId, (r) => {
      setRecords(r);
      setRecordsLoading(false);
    });
    return unsubscribe;
  }, [sessionId]);

  const { students, loading: studentsLoading } = useDivisionStudents(session?.divisionId);

  const rows = useMemo<AttendanceSessionRow[]>(() => {
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    return students.map((student) => ({ student, record: byStudent.get(student.studentId) ?? null }));
  }, [students, records]);

  const counts = useMemo<AttendanceCounts>(() => {
    const c: AttendanceCounts = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const { record } of rows) {
      if (!record) c.unmarked += 1;
      else c[record.status] += 1;
    }
    return c;
  }, [rows]);

  return {
    session,
    records,
    rows,
    counts,
    loading: sessionLoading || recordsLoading || studentsLoading,
  };
}
