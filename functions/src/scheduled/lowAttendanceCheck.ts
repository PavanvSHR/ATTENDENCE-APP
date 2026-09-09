/**
 * Runs daily at 18:00 server time. Computes each student's overall
 * attendance percentage from attendanceRecords and notifies (type:
 * "low_attendance") any student below settings/attendancePolicy
 * .minAttendancePercent.
 *
 * Scale note: this does a full collection scan of students and, per
 * student, a full query of their attendanceRecords. That's an acceptable,
 * simple approach for this project's scale (a single institution). A
 * larger deployment should page students and pre-aggregate attendance
 * counts (e.g. maintain a running counter document per student updated by
 * onAttendanceRecordWrite) instead of recomputing from scratch nightly.
 *
 * Throttling: this is a KNOWN SIMPLIFICATION — a student under the
 * threshold gets a fresh "low_attendance" notification every single day
 * this job runs, with no de-duplication/cooldown window. An institution
 * that finds this too noisy could refine it by, e.g., only notifying on
 * the first breach or on a weekly cadence; left simple here intentionally.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { db } from "../admin";
import type { AttendancePolicy, AttendanceRecord, StudentRecord, AppNotification } from "../types";

const DEFAULT_MIN_ATTENDANCE_PERCENT = 75;
const CHUNK_SIZE = 450;

export const lowAttendanceCheck = onSchedule(
  { schedule: "0 18 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const policySnap = await db.collection("settings").doc("attendancePolicy").get();
    const policy = policySnap.exists ? (policySnap.data() as AttendancePolicy) : undefined;
    const minAttendancePercent = policy?.minAttendancePercent ?? DEFAULT_MIN_ATTENDANCE_PERCENT;
    const lateCountsAsPresent = policy?.lateCountsAsPresent ?? true;

    const studentsSnap = await db.collection("students").where("status", "==", "active").get();
    logger.info(`lowAttendanceCheck: evaluating ${studentsSnap.size} active students against ${minAttendancePercent}% threshold`);

    const notifications: Omit<AppNotification, "notificationId">[] = [];
    const timestamp = new Date().toISOString();

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data() as StudentRecord;
      if (!student.userId) continue;

      const recordsSnap = await db
        .collection("attendanceRecords")
        .where("studentId", "==", studentDoc.id)
        .get();

      const total = recordsSnap.size;
      if (total === 0) continue; // no sessions yet — nothing meaningful to compute

      let counted = 0;
      recordsSnap.forEach((doc) => {
        const record = doc.data() as AttendanceRecord;
        if (record.status === "present") counted += 1;
        else if (record.status === "late" && lateCountsAsPresent) counted += 1;
        else if (record.status === "excused") counted += 1;
      });

      const percentage = (counted / total) * 100;
      if (percentage < minAttendancePercent) {
        notifications.push({
          userId: student.userId,
          type: "low_attendance",
          title: "Low attendance warning",
          message: `Your attendance is ${percentage.toFixed(1)}%, below the required ${minAttendancePercent}%.`,
          timestamp,
          read: false,
          relatedId: studentDoc.id,
        });
      }
    }

    await writeInChunks(notifications);
    logger.info(`lowAttendanceCheck: sent ${notifications.length} low_attendance notifications`);
  }
);

async function writeInChunks(notifications: Omit<AppNotification, "notificationId">[]): Promise<void> {
  for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
    const chunk = notifications.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const batch = db.batch();
    for (const notification of chunk) {
      const ref = db.collection("notifications").doc();
      batch.set(ref, notification);
    }
    await batch.commit();
  }
}
