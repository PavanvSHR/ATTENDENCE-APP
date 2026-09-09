import { db } from "../config/firebaseAdmin";
import { AuditLogEntry } from "../types";

/**
 * Writes an audit log entry to auditLogs/{logId}. logId is server-generated;
 * timestamp defaults to now (ISO string) unless the caller supplies one.
 * This is the single write path used by every route that needs to record
 * a TEACHER_MARKED_PRESENT / SESSION_LOCKED / DUPLICATE_ATTEMPT / etc entry,
 * so the audit trail stays consistent in shape.
 */
export async function writeAuditLog(entry: Omit<AuditLogEntry, "logId">): Promise<string> {
  const ref = db.collection("auditLogs").doc();
  const fullEntry: AuditLogEntry = {
    logId: ref.id,
    ...entry,
  };
  await ref.set(fullEntry);
  return ref.id;
}
