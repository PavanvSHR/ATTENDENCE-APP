import { useEffect, useState } from "react";
import type { AppNotification } from "@/types";
import { subscribeToNotifications } from "../services/notificationService";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToNotifications(userId, (data) => {
      setNotifications(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { notifications, loading };
}
