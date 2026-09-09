/**
 * Fires when the server/ API (Admin SDK) writes a new attendanceRecords/{id}
 * doc after a successful verification pipeline run (see
 * docs/ARCHITECTURE.md#verification-pipeline). Rejections never reach
 * Firestore — the backend returns those as an HTTP error straight to the
 * caller — so this trigger only ever sees accepted outcomes
 * (present/late/excused, or an admin/teacher-entered "absent" correction).
 *
 * Side effects, both best-effort (a notification failure must never roll
 * back or retry-loop the attendance record write itself):
 *   1. Always notify the student the record belongs to.
 *   2. If the record was flagged (`riskLevel === "high"` or
 *      `flaggedForReview === true`), additionally notify the session's
 *      teacher so they can review a possible proxy/spoof attempt.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { db } from "../admin";
import type { AttendanceRecord, AttendanceSession, TeacherRecord, StudentRecord, AppNotification } from "../types";

export const onAttendanceRecordWrite = onDocumentCreated(
  "attendanceRecords/{recordId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const record = snap.data() as AttendanceRecord;
    const recordId = event.params.recordId as string;

    await Promise.all([
      notifyStudent(record, recordId),
      record.riskLevel === "high" || record.flaggedForReview === true
        ? notifyTeacherOfSuspiciousAttempt(record, recordId)
        : Promise.resolve(),
    ]);
  }
);

async function notifyStudent(record: AttendanceRecord, recordId: string): Promise<void> {
  try {
    const studentSnap = await db.collection("students").doc(record.studentId).get();
    if (!studentSnap.exists) {
      logger.warn(`onAttendanceRecordWrite: student ${record.studentId} not found for record ${recordId}`);
      return;
    }
    const student = studentSnap.data() as StudentRecord;
    if (!student.userId) {
      logger.warn(`onAttendanceRecordWrite: student ${record.studentId} has no linked userId`);
      return;
    }

    const { title, message } = describeAttendanceMarked(record);

    const notification: Omit<AppNotification, "notificationId"> = {
      userId: student.userId,
      type: "attendance_marked",
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      relatedId: recordId,
    };
    await db.collection("notifications").add(notification);
  } catch (err) {
    // Notifications are a convenience layer, not the source of truth for
    // attendance — log and swallow rather than throwing, which would only
    // trigger pointless Cloud Functions retries.
    logger.error("onAttendanceRecordWrite: failed to notify student", err);
  }
}

async function notifyTeacherOfSuspiciousAttempt(record: AttendanceRecord, recordId: string): Promise<void> {
  try {
    const sessionSnap = await db.collection("attendanceSessions").doc(record.sessionId).get();
    if (!sessionSnap.exists) {
      logger.warn(`onAttendanceRecordWrite: session ${record.sessionId} not found for record ${recordId}`);
      return;
    }
    const session = sessionSnap.data() as AttendanceSession;

    const teacherQuery = await db
      .collection("teachers")
      .where("teacherId", "==", session.teacherId)
      .limit(1)
      .get();
    if (teacherQuery.empty) {
      logger.warn(`onAttendanceRecordWrite: no teacher doc found for teacherId ${session.teacherId}`);
      return;
    }
    const teacher = teacherQuery.docs[0].data() as TeacherRecord;
    if (!teacher.userId) {
      logger.warn(`onAttendanceRecordWrite: teacher ${session.teacherId} has no linked userId`);
      return;
    }

    const notification: Omit<AppNotification, "notificationId"> = {
      userId: teacher.userId,
      type: "suspicious_attempt",
      title: "Suspicious attendance attempt flagged",
      message: `${record.studentName} (${record.rollNumber}) was flagged for review in ${session.subjectName} on ${session.date} (risk: ${record.riskLevel}).`,
      timestamp: new Date().toISOString(),
      read: false,
      relatedId: recordId,
    };
    await db.collection("notifications").add(notification);
  } catch (err) {
    logger.error("onAttendanceRecordWrite: failed to notify teacher of suspicious attempt", err);
  }
}

function describeAttendanceMarked(record: AttendanceRecord): { title: string; message: string } {
  switch (record.status) {
    case "present":
      return { title: "Attendance marked present", message: `You were marked present.` };
    case "late":
      return { title: "Attendance marked late", message: `You were marked late.` };
    case "excused":
      return { title: "Attendance marked excused", message: `You were marked excused.` };
    default:
      return { title: "Attendance updated", message: `Your attendance status was updated to ${record.status}.` };
  }
}
