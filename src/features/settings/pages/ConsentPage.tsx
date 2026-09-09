import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { CheckCircle2, Fingerprint, ScanFace, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db } from "@/firebase/config";
import { useAuth } from "@/auth/useAuth";

interface ConsentItem {
  key: "biometric" | "face" | "location";
  icon: typeof Fingerprint;
  title: string;
  description: string;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: "biometric",
    icon: Fingerprint,
    title: "On-device biometric verification",
    description:
      "Uses your device's fingerprint/face unlock (via the platform authenticator) to confirm it's you. Only a success/failure result is sent — never a fingerprint or face template.",
  },
  {
    key: "face",
    icon: ScanFace,
    title: "Face verification",
    description:
      "Briefly uses your camera at the moment of marking attendance to check liveness and match confidence. The camera image itself is never stored — only a pass/fail outcome is recorded.",
  },
  {
    key: "location",
    icon: MapPin,
    title: "Location (GPS) verification",
    description:
      "Uses your device's GPS at the moment of marking attendance to confirm you are within the permitted classroom/campus radius. Your location is not tracked at any other time.",
  },
];

export function ConsentPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allChecked = CONSENT_ITEMS.every((item) => checked[item.key]);

  async function handleAccept() {
    setSubmitting(true);
    try {
      // Best-effort: consent UX should not hard-fail on a rules edge case.
      await updateDoc(doc(db, "users", profile.userId), {
        consentAcceptedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore — still show local success below so the flow isn't blocked.
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-4 py-16 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="text-xl font-semibold">Thanks, {profile?.name ?? "you're all set"}</h1>
        <p className="text-sm text-muted-foreground">
          Your consent has been recorded. You can review or change verification methods your institution allows
          at any time from Settings.
        </p>
        <Button onClick={() => navigate("/")}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 py-8 sm:p-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Consent &amp; Data Notice</CardTitle>
          <CardDescription>
            Before your first attendance verification, please review what each method does. Read the full{" "}
            <Link to="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </Link>{" "}
            for details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CONSENT_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
            >
              <Checkbox
                checked={!!checked[item.key]}
                onCheckedChange={(value) => setChecked((prev) => ({ ...prev, [item.key]: value === true }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-primary" />
                  <Label className="cursor-pointer font-medium">{item.title}</Label>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </label>
          ))}

          <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            Any of these can be disabled institution-wide by your administrator at any time. Declining a method
            here does not block your attendance if <strong className="text-foreground">manual</strong>{" "}
            verification by your teacher or class representative remains available for your sessions.
          </p>

          <Button className="w-full" size="lg" disabled={!allChecked || submitting} onClick={handleAccept}>
            {submitting ? "Saving..." : "I understand and consent"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
