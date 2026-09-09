/**
 * The fast, single-focus "mark my attendance" screen — used standing in a
 * classroom, in a hurry, on a phone. One big card, one step at a time, huge
 * tap targets. Every verification result collected here is only what the
 * CLIENT observed; the server independently re-verifies everything and makes
 * the real accept/reject call (see studentAttendanceService.submitSelfAttendance).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, MapPin, Fingerprint, ScanFace, QrCode, Loader2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/auth/useAuth";
import { useStudentAttendance } from "../hooks/useStudentAttendance";
import { registerDevice, submitSelfAttendance } from "../services/studentAttendanceService";
import { ApiError } from "../services/apiClient";
import { getOrCreateDeviceId } from "@/utils/device";
import { getCurrentPosition, haversineDistanceMeters, type ObservedLocation } from "@/features/geolocation/geofence";
import { verifyBiometric, BIOMETRIC_UNAVAILABLE_MESSAGE } from "@/features/biometric/webauthn";
import { FaceVerificationController, DEFAULT_LIVENESS_CUES } from "@/features/face/faceVerification";
import { QRScanner, type QRScanPayload } from "@/features/qr/components/QRScanner";
import type { AttendanceSession, VerificationMethod } from "@/types";
import type { SelfAttendanceAttemptInput } from "@/schemas/attendance.schema";

type Step = "select" | "qr" | "location" | "biometric" | "face" | "review" | "submitting" | "success" | "rejected";

const STEP_ORDER: VerificationMethod[] = ["qr", "location", "biometric", "face"];

export function StudentAttendancePage() {
  const { profile } = useAuth();
  const vm = useStudentAttendance();

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<{ timestamp: string } | null>(null);

  const [qrPayload, setQrPayload] = useState<QRScanPayload | null>(null);
  const [location, setLocation] = useState<ObservedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [biometricSuccess, setBiometricSuccess] = useState<boolean | null>(null);
  const [faceResult, setFaceResult] = useState<{ livenessPassed: boolean; matchConfidence: number } | null>(null);
  const [faceCue, setFaceCue] = useState<string>(DEFAULT_LIVENESS_CUES[0]);
  const [faceStreamReady, setFaceStreamReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const faceControllerRef = useRef(new FaceVerificationController());

  useEffect(() => {
    document.title = "Mark Attendance | Smart Attendance";
  }, []);

  // Auto-select the only open session; otherwise let the student pick.
  useEffect(() => {
    if (!session && vm.openSessions.length === 1) setSession(vm.openSessions[0]);
  }, [vm.openSessions, session]);

  // Best-effort device registration, once, if this device isn't on file yet.
  useEffect(() => {
    if (deviceRegistered || !vm.studentRecord) return;
    const deviceId = getOrCreateDeviceId();
    if (vm.studentRecord.registeredDeviceIds.includes(deviceId)) {
      setDeviceRegistered(true);
      return;
    }
    registerDevice("Web Browser", "web")
      .catch(() => undefined)
      .finally(() => setDeviceRegistered(true));
  }, [vm.studentRecord, deviceRegistered]);

  const requiredSteps = useMemo<VerificationMethod[]>(() => {
    if (!session) return [];
    return STEP_ORDER.filter((m) => session.verificationMethods.includes(m));
  }, [session]);

  const currentMethod = requiredSteps[stepIndex];
  const step: Step = !session ? "select" : stepIndex >= requiredSteps.length ? "review" : (currentMethod as Step);

  function goNext() {
    setStepIndex((i) => i + 1);
  }

  // ---- Location step ----
  useEffect(() => {
    if (step !== "location") return;
    let cancelled = false;
    setLocationError(null);
    getCurrentPosition()
      .then((loc) => {
        if (cancelled) return;
        setLocation(loc);
        goNext();
      })
      .catch((err: Error) => {
        if (!cancelled) setLocationError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---- Face step: open camera as soon as we enter it ----
  useEffect(() => {
    if (step !== "face") return;
    let cancelled = false;
    faceControllerRef
      .current!.openCamera()
      .then((stream) => {
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setFaceStreamReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setBlockedMessage(err.message);
      });
    return () => {
      cancelled = true;
      faceControllerRef.current?.closeCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handleQrScan(payload: QRScanPayload) {
    if (session && payload.sessionId !== session.sessionId) {
      setBlockedMessage("That QR code is for a different session. Ask your teacher for the right one.");
      return;
    }
    setQrPayload(payload);
    goNext();
  }

  async function handleBiometric() {
    try {
      const result = await verifyBiometric();
      setBiometricSuccess(result.success);
      goNext();
    } catch (err) {
      setBlockedMessage(err instanceof Error ? err.message : BIOMETRIC_UNAVAILABLE_MESSAGE);
    }
  }

  async function handleFaceCapture() {
    if (!videoRef.current) return;
    const frames = await faceControllerRef.current.captureLivenessSequence(videoRef.current, {
      onCue: (cue) => setFaceCue(cue),
    });
    void frames;
    const result = await faceControllerRef.current.verifyAgainstEnrollment(profile?.userId ?? "");
    setFaceResult(result);
    faceControllerRef.current.closeCamera();
    goNext();
  }

  async function handleSubmit() {
    if (!session || !profile) return;
    setSubmitting(true);
    setRejectReason(null);

    const payload: SelfAttendanceAttemptInput = {
      sessionId: session.sessionId,
      qrToken: qrPayload?.qrToken,
      deviceId: getOrCreateDeviceId(),
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            mockLocationSuspected: location.mockLocationSuspected,
          }
        : undefined,
      biometricAssertion: biometricSuccess !== null ? { success: biometricSuccess } : undefined,
      faceVerification: faceResult ?? undefined,
    };

    try {
      const record = await submitSelfAttendance(payload);
      setSuccessRecord({ timestamp: record.timestamp });
    } catch (err) {
      setRejectReason(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setSession(vm.openSessions.length === 1 ? vm.openSessions[0] : null);
    setStepIndex(0);
    setBlockedMessage(null);
    setRejectReason(null);
    setSuccessRecord(null);
    setQrPayload(null);
    setLocation(null);
    setLocationError(null);
    setBiometricSuccess(null);
    setFaceResult(null);
    setFaceStreamReady(false);
  }

  if (vm.loading) return <LoadingSpinner fullScreen label="Loading..." />;

  if (successRecord && session) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="h-20 w-20 text-success" />
        <h2 className="text-2xl font-bold">Attendance Successfully Marked</h2>
        <Card className="w-full text-left">
          <CardContent className="space-y-2 p-5">
            <Row label="Subject" value={session.subjectName} />
            <Row label="Date" value={format(new Date(session.date), "dd MMM yyyy")} />
            <Row label="Time" value={format(new Date(successRecord.timestamp), "hh:mm a")} />
            <Row label="Verification" value={session.verificationMethods.join(", ")} />
          </CardContent>
        </Card>
        <Button className="w-full" size="lg" onClick={resetFlow}>
          Done
        </Button>
      </div>
    );
  }

  if (rejectReason && session) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center">
        <XCircle className="h-20 w-20 text-destructive" />
        <h2 className="text-2xl font-bold">Attendance Not Marked</h2>
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {rejectReason}
        </p>
        <Button className="w-full" size="lg" onClick={resetFlow}>
          Try again
        </Button>
      </div>
    );
  }

  if (vm.openSessions.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No attendance session is open right now"
        description="Check back once your teacher starts attendance for a class."
      />
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-sm space-y-3">
        <h2 className="text-lg font-semibold">Select a class</h2>
        {vm.openSessions.map((s) => (
          <Card
            key={s.sessionId}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => setSession(s)}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{s.subjectName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(s.startTime), "hh:mm a")} · {s.teacherName}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center">
        <XCircle className="h-16 w-16 text-destructive" />
        <p className="text-lg font-medium">{blockedMessage}</p>
        <p className="text-sm text-muted-foreground">Ask your teacher to mark you present manually if this continues.</p>
        <Button variant="outline" className="w-full" onClick={resetFlow}>
          Start over
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <Card>
        <CardHeader className="pb-3 text-center">
          <CardTitle className="text-lg">{session.subjectName}</CardTitle>
          <CardDescription>
            {session.teacherName} · {format(new Date(session.startTime), "hh:mm a")}
          </CardDescription>
        </CardHeader>
      </Card>

      {step === "qr" && (
        <StepCard icon={QrCode} title="Scan the class QR code">
          <QRScanner onScan={handleQrScan} sessionId={session.sessionId} />
        </StepCard>
      )}

      {step === "location" && (
        <StepCard icon={MapPin} title="Checking your location">
          {locationError ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">{locationError}</p>
              <Button className="w-full" size="lg" onClick={() => setLocationError(null)}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Getting your GPS location...</p>
            </div>
          )}
          {location && session.location && (
            <Badge variant="outline" className="mx-auto mt-2">
              ~{Math.round(haversineDistanceMeters(location, session.location))}m from class
            </Badge>
          )}
        </StepCard>
      )}

      {step === "biometric" && (
        <StepCard icon={Fingerprint} title="Verify with device biometric">
          <p className="text-center text-sm text-muted-foreground">
            Use your fingerprint, face unlock, or device PIN to confirm it's you.
          </p>
          <Button className="w-full" size="lg" onClick={handleBiometric}>
            <Fingerprint className="mr-2 h-5 w-5" /> Verify
          </Button>
        </StepCard>
      )}

      {step === "face" && (
        <StepCard icon={ScanFace} title="Face verification">
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border border-border bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <p className="text-center text-sm font-medium">{faceCue}</p>
          <Button className="w-full" size="lg" onClick={handleFaceCapture} disabled={!faceStreamReady}>
            Start verification
          </Button>
        </StepCard>
      )}

      {step === "review" && (
        <StepCard icon={CheckCircle2} title="Ready to mark attendance">
          <div className="space-y-1.5 text-sm">
            {qrPayload && <Row label="QR" value="Scanned" />}
            {location && <Row label="Location" value="Captured" />}
            {biometricSuccess !== null && <Row label="Biometric" value={biometricSuccess ? "Verified" : "Not verified"} />}
            {faceResult && <Row label="Face" value={faceResult.livenessPassed ? "Verified" : "Not verified"} />}
          </div>
          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Mark My Attendance
          </Button>
        </StepCard>
      )}
    </div>
  );
}

function StepCard({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
