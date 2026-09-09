/**
 * Multi-select chip grid for choosing which verification methods a session
 * accepts. Used in Create Session; enforces "at least one" (surfaced via the
 * `error` prop, driven by createSessionSchema) and shows helper text per
 * method so a teacher understands what proxy-prevention each one buys them.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, Fingerprint, MapPin, QrCode, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationMethod } from "@/types";

const METHODS: { value: VerificationMethod; label: string; icon: LucideIcon; helper: string }[] = [
  {
    value: "biometric",
    label: "Biometric",
    icon: Fingerprint,
    helper: "Device fingerprint/biometric confirms the student in person.",
  },
  {
    value: "face",
    label: "Face recognition",
    icon: ScanFace,
    helper: "Live face match with liveness check — no raw photos are stored.",
  },
  {
    value: "location",
    label: "Location",
    icon: MapPin,
    helper: "Student must be inside the classroom geofence to check in.",
  },
  {
    value: "manual",
    label: "Manual",
    icon: ClipboardCheck,
    helper: "Teacher or CR can mark students directly from the live list.",
  },
  {
    value: "qr",
    label: "QR code",
    icon: QrCode,
    helper: "Display a rotating QR code students scan to check in.",
  },
];

interface VerificationMethodSelectorProps {
  value: VerificationMethod[];
  onChange: (value: VerificationMethod[]) => void;
  error?: string;
}

export function VerificationMethodSelector({ value, onChange, error }: VerificationMethodSelectorProps) {
  function toggle(method: VerificationMethod) {
    if (value.includes(method)) onChange(value.filter((m) => m !== method));
    else onChange([...value, method]);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {METHODS.map(({ value: method, label, icon: Icon, helper }) => {
          const active = value.includes(method);
          return (
            <button
              key={method}
              type="button"
              onClick={() => toggle(method)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{helper}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
