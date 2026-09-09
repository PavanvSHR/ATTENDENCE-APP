/**
 * Read-only access to the audit log. Audit entries are written exclusively
 * by trusted server-side code (Cloud Functions / the server/ API) as part
 * of the attendance/session/auth pipelines — this module never writes to
 * `auditLogs`, it only subscribes for display.
 */
import { limit as fsLimit, onSnapshot, orderBy, query, where, type QueryConstraint, type Unsubscribe } from "firebase/firestore";
import { auditLogsCol } from "@/firebase/firestore";
import type { AuditAction, AuditLogEntry } from "@/types";

export interface AuditLogFilters {
  action?: AuditAction;
  userId?: string;
  targetType?: AuditLogEntry["targetType"];
  from?: string; // ISO datetime/date lower bound (inclusive)
  to?: string; // ISO datetime/date upper bound (inclusive)
}

/**
 * Subscribes to a live, newest-first stream of audit log entries.
 * Only `timestamp` is range-filtered server-side (a single range clause
 * plus a matching `orderBy` needs no composite index); `action`, `userId`,
 * and `targetType` are applied client-side so this always works without
 * any Firestore index configuration. Returns the `onSnapshot` unsubscribe
 * function — callers must invoke it on unmount.
 */
export function subscribeToAuditLogs(
  filters: AuditLogFilters,
  cb: (entries: AuditLogEntry[]) => void,
  maxEntries = 500
): Unsubscribe {
  const clauses: QueryConstraint[] = [];
  if (filters.from) clauses.push(where("timestamp", ">=", filters.from));
  if (filters.to) clauses.push(where("timestamp", "<=", filters.to));
  clauses.push(orderBy("timestamp", "desc"));
  clauses.push(fsLimit(maxEntries));

  return onSnapshot(query(auditLogsCol, ...clauses), (snap) => {
    let entries = snap.docs.map((d) => d.data());
    if (filters.action) entries = entries.filter((e) => e.action === filters.action);
    if (filters.userId) entries = entries.filter((e) => e.userId === filters.userId);
    if (filters.targetType) entries = entries.filter((e) => e.targetType === filters.targetType);
    cb(entries);
  });
}
