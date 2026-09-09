import { useEffect, useState } from "react";
import { subscribeToNotifications } from "../services/notificationService";

export function useUnreadNotificationCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    const unsubscribe = subscribeToNotifications(userId, (notifications) => {
      setCount(notifications.filter((n) => !n.read).length);
    });
    return unsubscribe;
  }, [userId]);

  return count;
}
