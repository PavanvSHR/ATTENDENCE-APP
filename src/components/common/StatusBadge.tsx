import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus, SessionStatus, AccountStatus } from "@/types";

const attendanceMap: Record<AttendanceStatus, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  present: { label: "Present", variant: "success" },
  absent: { label: "Absent", variant: "destructive" },
  late: { label: "Late", variant: "warning" },
  excused: { label: "Excused", variant: "secondary" },
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const { label, variant } = attendanceMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const sessionMap: Record<SessionStatus, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  open: { label: "Open", variant: "success" },
  finalized: { label: "Finalized", variant: "secondary" },
  locked: { label: "Locked", variant: "secondary" },
  expired: { label: "Expired", variant: "destructive" },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { label, variant } = sessionMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const accountMap: Record<AccountStatus, { label: string; variant: "success" | "destructive" | "warning" }> = {
  active: { label: "Active", variant: "success" },
  disabled: { label: "Disabled", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const { label, variant } = accountMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}
