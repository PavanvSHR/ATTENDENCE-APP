/**
 * The "live student list" manual marking UI: search, select-all, per-row
 * Present/Absent/Late/Excused button group (fast to tap, not a dropdown),
 * bulk "mark selected present", and a required reason whenever a status is
 * changed on a student who already has a record (so silent overwrites of an
 * existing mark are never possible). Saves via the server API — the server
 * is the one that stamps markedBy/markedByRole/timestamp and writes the
 * audit log entry, and rejects the whole batch if the session is locked.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { manualAttendanceBatchSchema, type ManualAttendanceBatchInput } from "@/schemas/attendance.schema";
import type { AttendanceStatus } from "@/types";
import type { AttendanceSessionRow } from "../hooks/useAttendanceSession";
import { markManualAttendance } from "../services/sessionService";

const STATUS_META: Record<AttendanceStatus, { label: string; activeClass: string }> = {
  present: { label: "P", activeClass: "border-success bg-success text-success-foreground" },
  absent: { label: "A", activeClass: "border-destructive bg-destructive text-destructive-foreground" },
  late: { label: "L", activeClass: "border-warning bg-warning text-warning-foreground" },
  excused: { label: "E", activeClass: "border-secondary bg-secondary text-secondary-foreground" },
};

interface ManualAttendanceListProps {
  sessionId: string;
  rows: AttendanceSessionRow[];
  disabled?: boolean;
}

export function ManualAttendanceList({ sessionId, rows, disabled = false }: ManualAttendanceListProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      ({ student }) => student.name.toLowerCase().includes(q) || student.rollNumber.toLowerCase().includes(q)
    );
  }, [search, rows]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(({ student }) => selected.has(student.studentId));

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDrafts((prev) => ({ ...prev, [studentId]: status }));
  }

  function setReason(studentId: string, reason: string) {
    setReasons((prev) => ({ ...prev, [studentId]: reason }));
  }

  function toggleSelected(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach(({ student }) => next.delete(student.studentId));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach(({ student }) => next.add(student.studentId));
      return next;
    });
  }

  function markSelectedPresent() {
    if (selected.size === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      selected.forEach((id) => {
        next[id] = "present";
      });
      return next;
    });
  }

  const changedEntries = useMemo(
    () =>
      rows
        .filter(({ student, record }) => {
          const draft = drafts[student.studentId];
          return draft !== undefined && draft !== record?.status;
        })
        .map(({ student, record }) => ({ studentId: student.studentId, hadRecord: Boolean(record), status: drafts[student.studentId] })),
    [rows, drafts]
  );

  const missingReasonCount = changedEntries.filter((e) => e.hadRecord && !reasons[e.studentId]?.trim()).length;

  async function handleSave() {
    if (disabled) return;
    if (changedEntries.length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    if (missingReasonCount > 0) {
      toast({
        title: "Reason required",
        description: `Explain why for ${missingReasonCount} record(s) that already had a status before you can save.`,
        variant: "destructive",
      });
      return;
    }

    const entries: ManualAttendanceBatchInput["entries"] = changedEntries.map((e) => ({
      studentId: e.studentId,
      status: e.status,
      reason: e.hadRecord ? reasons[e.studentId]?.trim() : undefined,
    }));

    const parsed = manualAttendanceBatchSchema.safeParse({ sessionId, entries });
    if (!parsed.success) {
      toast({
        title: "Couldn't save attendance",
        description: parsed.error.issues[0]?.message ?? "Check the marked entries and try again.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const res = await markManualAttendance(parsed.data);
    setSaving(false);

    if (!res.success) {
      toast({ title: "Couldn't save attendance", description: res.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Attendance saved", description: `${res.data.length} record(s) updated.` });
    setDrafts({});
    setReasons({});
    setSelected(new Set());
  }

  if (rows.length === 0) {
    return <EmptyState title="No students to mark" description="This division has no students on record yet." />;
  }

  return (
    <div className="space-y-3">
      {disabled && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          This session is locked. Manual marking is disabled — use a per-record correction instead.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={markSelectedPresent} disabled={disabled || selected.size === 0}>
            Mark selected present ({selected.size})
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={disabled || saving || changedEntries.length === 0}>
            {saving ? "Saving..." : `Save${changedEntries.length > 0 ? ` (${changedEntries.length})` : ""}`}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} disabled={disabled} aria-label="Select all" />
        <span className="text-sm text-muted-foreground">
          Select all {filtered.length !== rows.length ? `(${filtered.length} shown)` : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matches" description="No students match that search." />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filtered.map(({ student, record }) => {
            const draft = drafts[student.studentId] ?? record?.status;
            const changed = drafts[student.studentId] !== undefined && drafts[student.studentId] !== record?.status;
            const needsReason = changed && record;

            return (
              <div key={student.studentId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  <Checkbox
                    checked={selected.has(student.studentId)}
                    onCheckedChange={() => toggleSelected(student.studentId)}
                    disabled={disabled}
                    aria-label={`Select ${student.name}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(Object.keys(STATUS_META) as AttendanceStatus[]).map((status) => {
                    const meta = STATUS_META[status];
                    const active = draft === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={disabled}
                        onClick={() => setStatus(student.studentId, status)}
                        aria-pressed={active}
                        title={status[0].toUpperCase() + status.slice(1)}
                        className={cn(
                          "h-8 w-8 shrink-0 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          active ? meta.activeClass : "border-input bg-background text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {needsReason && (
                  <Textarea
                    placeholder="Reason for changing an existing record (required)..."
                    value={reasons[student.studentId] ?? ""}
                    onChange={(e) => setReason(student.studentId, e.target.value)}
                    disabled={disabled}
                    className="min-h-[38px] sm:w-64"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
