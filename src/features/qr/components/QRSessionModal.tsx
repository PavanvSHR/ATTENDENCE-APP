/**
 * QR check-in modal for an open session. Encodes ONLY { sessionId, qrToken }
 * — never student info — so a screenshot leaks nothing beyond a short-lived
 * token. Counts down to `qrExpiresAt` and calls `rotateQr` shortly before it
 * lapses; the refreshed token/expiry flow back in via the caller's live
 * Firestore session subscription (see useAttendanceSession), so this
 * component only triggers the rotation, it doesn't own the resulting state.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";
import { rotateQr } from "@/features/attendance/services/sessionService";

interface QRSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  qrToken?: string;
  qrExpiresAt?: string;
  /** Trigger a rotation this many seconds before expiry. Defaults to 5s. */
  rotateBeforeExpirySeconds?: number;
}

export function QRSessionModal({
  open,
  onOpenChange,
  sessionId,
  qrToken,
  qrExpiresAt,
  rotateBeforeExpirySeconds = 5,
}: QRSessionModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const rotatingRef = useRef(false);
  const { toast } = useToast();

  // A fresh token arrived (rotation succeeded) — clear the in-flight guard.
  useEffect(() => {
    rotatingRef.current = false;
  }, [qrToken]);

  useEffect(() => {
    if (!open || !qrToken) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(JSON.stringify({ sessionId, qrToken }), { margin: 1, width: 280 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, qrToken]);

  useEffect(() => {
    if (!open || !qrExpiresAt) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(qrExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= rotateBeforeExpirySeconds && !rotatingRef.current) {
        rotatingRef.current = true;
        rotateQr(sessionId).then((res) => {
          if (!res.success) {
            rotatingRef.current = false;
            toast({ title: "QR refresh failed", description: res.error.message, variant: "destructive" });
          }
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [open, qrExpiresAt, sessionId, rotateBeforeExpirySeconds, toast]);

  const expired = secondsLeft === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Scan to mark attendance
          </DialogTitle>
          <DialogDescription>
            Students scan this with the app to check in. It refreshes automatically so a photo of it can't be reused.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Session check-in QR code"
              className="h-64 w-64 rounded-md border border-border bg-white p-2"
            />
          ) : (
            <LoadingSpinner label="Generating QR code..." />
          )}
          {secondsLeft !== null && (
            <p className="text-sm text-muted-foreground">
              {expired ? (
                "Refreshing..."
              ) : (
                <>
                  Refreshes in <span className="font-medium text-foreground">{secondsLeft}s</span>
                </>
              )}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
