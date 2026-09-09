import {
  addDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { notificationsCol } from "@/firebase/firestore";
import type { AppNotification, NotificationType } from "@/types";

/** Live-subscribes to a user's most recent notifications, newest first. */
export function subscribeToNotifications(
  userId: string,
  onChange: (notifications: AppNotification[]) => void,
  max = 50
) {
  const q = query(notificationsCol, where("userId", "==", userId), orderBy("timestamp", "desc"), limit(max));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data())));
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(notifications: AppNotification[]) {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, "notifications", n.notificationId), { read: true }));
  await batch.commit();
}

/**
 * Client-side notification creation is limited to informational, non-attendance
 * events a user triggers for themselves (e.g. acknowledging a policy). All
 * attendance/session/audit-driven notifications (attendance_marked,
 * low_attendance, suspicious_attempt, etc.) are written server-side by the
 * Express API / Cloud Functions so they can't be forged by a client. See
 * server/src/services/... and functions/src/triggers/...
 */
export async function createSelfNotification(userId: string, type: NotificationType, title: string, message: string) {
  await addDoc(notificationsCol, {
    notificationId: "", // set by Cloud Function or left blank for client-originated notices
    userId,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  } as AppNotification);
}

export { serverTimestamp };
