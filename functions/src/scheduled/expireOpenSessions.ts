/**
 * Runs every 15 minutes. Finds attendanceSessions still "open" whose
 * endTime has passed and flips them to "expired" so:
 *   - students can no longer self-mark attendance against them (the
 *     server/ API's session-status check will reject once status !=
 *     "open"),
 *   - teacher/admin dashboards stop presenting them as live.
 *
 * This is a Cloud Function rather than something the backend does inline
 * on each request because a session with zero further attendance attempts
 * after its endTime would otherwise sit in "open" forever — nothing would
 * ever trigger the transition.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { db } from "../admin";

const CHUNK_SIZE = 450;

export const expireOpenSessions = onSchedule(
  { schedule: "every 15 minutes" },
  async () => {
    const nowIso = new Date().toISOString();

    const expiredSnap = await db
      .collection("attendanceSessions")
      .where("status", "==", "open")
      .where("endTime", "<", nowIso)
      .get();

    if (expiredSnap.empty) {
      logger.info("expireOpenSessions: no open sessions past endTime");
      return;
    }

    const docs = expiredSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, { status: "expired" });
      }
      await batch.commit();
    }

    logger.info(`expireOpenSessions: expired ${docs.length} session(s)`);
  }
);
