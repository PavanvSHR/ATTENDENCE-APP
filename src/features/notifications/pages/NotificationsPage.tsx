import { useEffect } from "react";
import { Bell, CheckCheck, AlertTriangle, UserCheck, XCircle, TrendingDown, PlayCircle, StopCircle, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/auth/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import { markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types";

const ICONS: Record<NotificationType, LucideIcon> = {
  attendance_marked: UserCheck,
  attendance_rejected: XCircle,
  low_attendance: TrendingDown,
  session_started: PlayCircle,
  session_closed: StopCircle,
  attendance_correction: Pencil,
  suspicious_attempt: AlertTriangle,
};

export function NotificationsPage() {
  const { profile } = useAuth();
  const { notifications, loading } = useNotifications(profile?.userId);

  useEffect(() => {
    document.title = "Notifications | Smart Attendance";
  }, []);

  if (loading) return <LoadingSpinner label="Loading notifications..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Attendance, session, and security alerts relevant to you.</p>
        </div>
        {notifications.some((n) => !n.read) && (
          <Button variant="outline" size="sm" onClick={() => markAllNotificationsRead(notifications)}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="You'll see attendance and session alerts here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <Card
                key={n.notificationId}
                className={cn("cursor-pointer transition-colors", !n.read && "border-primary/40 bg-primary/5")}
                onClick={() => !n.read && markNotificationRead(n.notificationId)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", !n.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{n.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                  </div>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
