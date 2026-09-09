import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, QrCode, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { SessionStatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/components/ui/use-toast";
import { useAttendanceSession } from "../hooks/useAttendanceSession";
import { finalizeSession, lockSession } from "../services/sessionService";
import { LiveAttendanceTable } from "../components/LiveAttendanceTable";
import { ManualAttendanceList } from "../components/ManualAttendanceList";
import { QRSessionModal } from "@/features/qr/components/QRSessionModal";
import type { VerificationMethod } from "@/types";

const METHOD_LABELS: Record<VerificationMethod, string> = {
  biometric: "Biometric",
  face: "Face",
  location: "Location",
  manual: "Manual",
  qr: "QR",
};

export function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, rows, counts, loading } = useAttendanceSession(sessionId);

  const [qrOpen, setQrOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = session ? `${session.subjectName} | Live Attendance` : "Live Attendance | Smart Attendance";
  }, [session]);

  if (!sessionId) {
    return <EmptyState title="No session selected" description="Start attendance from your dashboard first." />;
  }

  if (loading) return <LoadingSpinner fullScreen label="Loading session..." />;

  if (!session) {
    return (
      <EmptyState
        title="Session not found"
        description="This attendance session doesn't exist or you don't have access to it."
        action={<Button onClick={() => navigate("/teacher")}>Back to dashboard</Button>}
      />
    );
  }

  const isOpen = session.status === "open";
  const isFinalized = session.status === "finalized";
  const isLocked = session.status === "locked";

  async function handleFinalize() {
    setBusy(true);
    const res = await finalizeSession(sessionId!);
    setBusy(false);
    setFinalizeOpen(false);
    if (!res.success) {
      toast({ title: "Couldn't finalize session", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attendance finalized", description: "Students can no longer self-mark for this session." });
  }

  async function handleLock() {
    setBusy(true);
    const res = await lockSession(sessionId!);
    setBusy(false);
    setLockOpen(false);
    if (!res.success) {
      toast({ title: "Couldn't lock session", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Session locked", description: "Further changes now require a per-record correction." });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{session.subjectName}</CardTitle>
              <SessionStatusBadge status={session.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{session.teacherName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.verificationMethods.map((m) => (
              <Badge key={m} variant="outline">
                {METHOD_LABELS[m]}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {format(new Date(session.date), "dd MMM yyyy")}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {format(new Date(session.startTime), "hh:mm a")} – {format(new Date(session.endTime), "hh:mm a")}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {session.location ? `Radius ${session.radiusMeters ?? "—"} m` : "No location set"}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> {counts.present + counts.late}/{counts.total} present
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {session.verificationMethods.includes("qr") && isOpen && (
          <Button variant="outline" onClick={() => setQrOpen(true)}>
            <QrCode className="mr-2 h-4 w-4" /> Show QR code
          </Button>
        )}
        {isOpen && (
          <Button onClick={() => setFinalizeOpen(true)} disabled={busy}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Finalize Attendance
          </Button>
        )}
        {isFinalized && (
          <Button variant="destructive" onClick={() => setLockOpen(true)} disabled={busy}>
            <Lock className="mr-2 h-4 w-4" /> Lock Session
          </Button>
        )}
      </div>

      {isLocked && (
        <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          This session is locked. Attendance is final — any change now requires a per-record correction with a
          reason, which is logged to the audit trail.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Total", counts.total],
            ["Present", counts.present],
            ["Absent", counts.absent],
            ["Late", counts.late],
            ["Excused", counts.excused],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <LiveAttendanceTable rows={rows} />
        </TabsContent>
        <TabsContent value="manual">
          <ManualAttendanceList sessionId={sessionId} rows={rows} disabled={isLocked} />
        </TabsContent>
      </Tabs>

      <QRSessionModal
        open={qrOpen}
        onOpenChange={setQrOpen}
        sessionId={sessionId}
        qrToken={session.qrToken}
        qrExpiresAt={session.qrExpiresAt}
      />

      <ConfirmDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title="Finalize this session?"
        description="Students will no longer be able to self-mark attendance for this session. You can still make corrections afterward."
        confirmLabel="Finalize"
        onConfirm={handleFinalize}
      />

      <ConfirmDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        title="Lock this session?"
        description="This is irreversible. After locking, any change to a record requires a documented correction reason."
        confirmLabel="Lock session"
        destructive
        onConfirm={handleLock}
      />
    </div>
  );
}
