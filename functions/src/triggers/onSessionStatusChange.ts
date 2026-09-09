/**
 * Fires on every write to attendanceSessions/{sessionId} (created only by
 * the server/ API, per firestore.rules — clients cannot write sessions at
 * all). We only act on `status` transitions:
 *   -> "open":                 notify every student in the division that a
 *                               session has started (they should open the
 *                               app and mark attendance).
 *   -> "finalized" | "locked": notify the same set that the session has
 *                               closed (a nudge for anyone who hasn't
 *                               marked yet, and a signal that corrections
 *                               now require the CR/teacher correction flow
 *                               enforced server-side).
 *
 * Uses onDocumentWritten so it also covers the update path (the only path,
 * since sessions are created directly with an initial status by the
 * backend, then patched forward through the state machine); we diff
 * before/after `status` ourselves.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { db } from "../admin";
import type { AttendanceSession, StudentRecord, AppNotification, NotificationType } from "../types";

// Firestore hard-caps a single batch at 500 writes; chunk conservatively
// below that ceiling.
const CHUNK_SIZE = 450;

export const onSessionStatusChange = onDocumentWritten(
  "attendanceSessions/{sessionId}",
  async (event) => {
    const before = event.data?.before?.data() as AttendanceSession | undefined;
    const after = event.data?.after?.data() as AttendanceSession | undefined;
    if (!after) return; // deleted — nothing to notify
    if (before?.status === after.status) return; // not a status transition

    let type: NotificationType | null = null;
    let title = "";
    let messageFor: ((session: AttendanceSession) => string) | null = null;

    if (after.status === "open") {
      type = "session_started";
      title = "Attendance session started";
      messageFor = (s) => `${s.subjectName} attendance is now open. Mark your attendance before it closes.`;
    } else if (after.status === "finalized" || after.status === "locked") {
      type = "session_closed";
      title = "Attendance session closed";
      messageFor = (s) => `${s.subjectName} attendance has closed.`;
    } else {
      return; // draft/expired transitions don't fan out notifications
    }

    try {
      const studentsSnap = await db
        .collection("students")
        .where("divisionId", "==", after.divisionId)
        .get();

      const notifications: Omit<AppNotification, "notificationId">[] = [];
      const timestamp = new Date().toISOString();

      studentsSnap.forEach((doc) => {
        const student = doc.data() as StudentRecord;
        if (!student.userId) {
          // Not yet linked to a Firebase Auth account — nothing to notify.
          return;
        }
        notifications.push({
          userId: student.userId,
          type: type as NotificationType,
          title,
          message: messageFor ? messageFor(after) : "",
          timestamp,
          read: false,
          relatedId: after.sessionId || event.params.sessionId,
        });
      });

      await writeInChunks(notifications);
      logger.info(
        `onSessionStatusChange: fanned out ${notifications.length} "${type}" notifications for session ${event.params.sessionId}`
      );
    } catch (err) {
      logger.error("onSessionStatusChange: failed to fan out notifications", err);
    }
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
