/**
 * Read-only live view of a session's attendance. One row per student in the
 * division; students with no record yet show "—" placeholders rather than
 * being omitted, so a teacher can see at a glance who hasn't checked in.
 */
import { format } from "date-fns";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { AttendanceStatusBadge } from "@/components/common/StatusBadge";
import { RiskBadge, riskLevelFromScore } from "@/components/common/RiskBadge";
import type { AttendanceRecord, VerificationMethod } from "@/types";
import type { AttendanceSessionRow } from "../hooks/useAttendanceSession";

const METHOD_LABELS: Partial<Record<VerificationMethod, string>> = {
  biometric: "Biometric",
  face: "Face",
  location: "Location",
  qr: "QR",
};

function verificationSummary(record: AttendanceRecord | null): string {
  if (!record) return "—";
  const passed: string[] = [];
  if (record.verification.biometric === "success") passed.push(METHOD_LABELS.biometric!);
  if (record.verification.face === "success") passed.push(METHOD_LABELS.face!);
  if (record.verification.location === "success") passed.push(METHOD_LABELS.location!);
  if (record.verification.qr === "success") passed.push(METHOD_LABELS.qr!);
  if (record.method === "manual") passed.push("Manual");
  return passed.length > 0 ? passed.join(", ") : "—";
}

export function LiveAttendanceTable({ rows }: { rows: AttendanceSessionRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No students found"
        description="This division has no students on record yet."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Roll No</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Verification</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Risk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ student, record }) => (
          <TableRow key={student.studentId} data-state={record?.flaggedForReview ? "selected" : undefined}>
            <TableCell className="font-medium">{student.rollNumber}</TableCell>
            <TableCell>{student.name}</TableCell>
            <TableCell>
              {record ? <AttendanceStatusBadge status={record.status} /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{verificationSummary(record)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {record ? format(new Date(record.timestamp), "hh:mm a") : "—"}
            </TableCell>
            <TableCell>
              {record ? <RiskBadge level={riskLevelFromScore(record.riskScore)} /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
