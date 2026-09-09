import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface QRScanPayload {
  sessionId: string;
  qrToken: string;
}

interface QRScannerProps {
  /** Called once with the decoded (or manually entered) payload. */
  onScan: (payload: QRScanPayload) => void;
  /**
   * Session context already known by the caller — used to pair a manually
   * entered token when the typed text is just the token, not full JSON.
   */
  sessionId?: string;
  className?: string;
}

function parsePayload(raw: string, fallbackSessionId?: string): QRScanPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.sessionId === "string" && typeof parsed.qrToken === "string") {
      return { sessionId: parsed.sessionId, qrToken: parsed.qrToken };
    }
  } catch {
    // Not JSON — fall through to treating it as a bare token below.
  }

  if (fallbackSessionId) {
    return { sessionId: fallbackSessionId, qrToken: trimmed };
  }
  return null;
}

/**
 * Camera-based QR scanner: samples frames from a live `<video>` feed onto a
 * hidden `<canvas>` and decodes them with `jsqr` (no external scanning
 * service). Expects the QR to encode `{"sessionId":"...","qrToken":"..."}`.
 * Falls back to a manual code-entry field when the camera is unavailable,
 * permission is denied, or for accessibility/low-end devices.
 */
export function QRScanner({ onScan, sessionId, className }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scannedRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const payload = parsePayload(code.data, sessionId);
          if (payload) {
            scannedRef.current = true;
            stopCamera();
            onScan(payload);
            return;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onScan, sessionId, stopCamera]);

  useEffect(() => {
    if (manualMode) return;
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not supported on this device.");
        setManualMode(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") setCameraError("Camera permission denied.");
        else if (name === "NotFoundError") setCameraError("No camera found on this device.");
        else setCameraError("Unable to access the camera.");
        setManualMode(true);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode]);

  function handleManualSubmit() {
    const payload = parsePayload(manualValue, sessionId);
    if (!payload) {
      setManualError("Enter the full code shown on screen, or ask your teacher for the session code.");
      return;
    }
    setManualError(null);
    onScan(payload);
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {!manualMode && (
        <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-black aspect-square">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70" />
        </div>
      )}

      {cameraError && !manualMode && <p className="text-sm text-destructive">{cameraError}</p>}

      {!manualMode ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setManualMode(true)}>
          <KeyRound className="mr-2 h-4 w-4" />
          Enter code manually instead
        </Button>
      ) : (
        <div className="w-full max-w-sm space-y-3">
          {cameraError && <p className="text-sm text-muted-foreground">{cameraError} Enter the code shown by your teacher instead.</p>}
          <div className="space-y-1.5">
            <Label htmlFor="manual-qr-code">Session code</Label>
            <Input
              id="manual-qr-code"
              inputMode="text"
              autoComplete="off"
              placeholder="Paste or type the code"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
            />
            {manualError && <p className="text-sm text-destructive">{manualError}</p>}
          </div>
          <Button type="button" className="w-full" size="lg" onClick={handleManualSubmit} disabled={!manualValue.trim()}>
            Submit code
          </Button>
          {!cameraError && (
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setManualMode(false)}>
              <Camera className="mr-2 h-4 w-4" />
              Use camera instead
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
