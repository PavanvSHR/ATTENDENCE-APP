import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, History, Search, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { subscribeToAuditLogs, type AuditLogFilters } from "../services/auditService";
import type { AuditAction, AuditLogEntry } from "@/types";

const ALL_ACTIONS: AuditAction[] = [
  "TEACHER_MARKED_PRESENT",
  "TEACHER_CHANGED_ATTENDANCE",
  "CR_MARKED_PRESENT",
  "STUDENT_SELF_MARKED",
  "ADMIN_MODIFIED_ATTENDANCE",
  "BIOMETRIC_FAILED",
  "FACE_FAILED",
  "LOCATION_FAILED",
  "DUPLICATE_ATTEMPT",
  "SESSION_CREATED",
  "SESSION_STARTED",
  "SESSION_FINALIZED",
  "SESSION_LOCKED",
  "DEVICE_REGISTERED",
  "DEVICE_REJECTED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
];

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

const ACTION_VARIANT: Record<AuditAction, BadgeVariant> = {
  TEACHER_MARKED_PRESENT: "success",
  CR_MARKED_PRESENT: "success",
  STUDENT_SELF_MARKED: "success",
  DEVICE_REGISTERED: "success",
  LOGIN_SUCCESS: "success",
  SESSION_FINALIZED: "success",

  TEACHER_CHANGED_ATTENDANCE: "warning",
  ADMIN_MODIFIED_ATTENDANCE: "warning",

  DUPLICATE_ATTEMPT: "destructive",
  BIOMETRIC_FAILED: "destructive",
  FACE_FAILED: "destructive",
  LOCATION_FAILED: "destructive",
  DEVICE_REJECTED: "destructive",
  LOGIN_FAILED: "destructive",

  SESSION_CREATED: "secondary",
  SESSION_STARTED: "secondary",
  SESSION_LOCKED: "secondary",
};

function actionLabel(action: AuditAction): string {
  return action
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const ALL = "all";

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<AuditAction | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filters: AuditLogFilters = useMemo(
    () => ({
      action: action || undefined,
      from: from ? `${from}T00:00:00.000` : undefined,
      to: to ? `${to}T23:59:59.999` : undefined,
    }),
    [action, from, to]
  );

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToAuditLogs(filters, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [filters]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.userId.toLowerCase().includes(term) || e.targetId.toLowerCase().includes(term));
  }, [entries, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">A complete, tamper-evident trail of attendance and system events.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>Audit logs are append-only and cannot be edited or deleted from this interface.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action || ALL} onValueChange={(v) => setAction(v === ALL ? "" : (v as AuditAction))}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {ALL_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-search">Search (user or target ID)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-search"
                className="pl-9"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Log Entries</CardTitle>
          <Badge variant="secondary">{visibleEntries.length} entries</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner label="Loading audit log..." />
          ) : visibleEntries.length === 0 ? (
            <EmptyState icon={History} title="No audit entries found" description="Try widening the date range or clearing filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => {
                  const isExpanded = expandedId === entry.logId;
                  const hasDetails = Boolean(
                    entry.previousValue !== undefined ||
                      entry.newValue !== undefined ||
                      entry.reason ||
                      entry.verificationMethod
                  );
                  return (
                    <>
                      <TableRow
                        key={entry.logId}
                        className={hasDetails ? "cursor-pointer" : undefined}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.logId)}
                      >
                        <TableCell>
                          {hasDetails ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{entry.userId}</span>
                            <span className="text-xs text-muted-foreground">{entry.userRole}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[entry.action]}>{actionLabel(entry.action)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{entry.targetType}</span>
                            <span className="font-mono text-xs">{entry.targetId}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${entry.logId}-details`} className="hover:bg-transparent">
                          <TableCell />
                          <TableCell colSpan={4} className="whitespace-normal">
                            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                              {entry.reason && (
                                <div>
                                  <span className="font-medium text-foreground">Reason: </span>
                                  <span className="text-muted-foreground">{entry.reason}</span>
                                </div>
                              )}
                              {entry.verificationMethod && (
                                <div>
                                  <span className="font-medium text-foreground">Verification method: </span>
                                  <span className="text-muted-foreground">{entry.verificationMethod}</span>
                                </div>
                              )}
                              {entry.ipAddress && (
                                <div>
                                  <span className="font-medium text-foreground">IP address: </span>
                                  <span className="text-muted-foreground">{entry.ipAddress}</span>
                                </div>
                              )}
                              {entry.previousValue !== undefined && (
                                <div>
                                  <p className="font-medium text-foreground">Previous value</p>
                                  <pre className="mt-1 overflow-x-auto rounded bg-background p-2">
                                    {JSON.stringify(entry.previousValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {entry.newValue !== undefined && (
                                <div>
                                  <p className="font-medium text-foreground">New value</p>
                                  <pre className="mt-1 overflow-x-auto rounded bg-background p-2">
                                    {JSON.stringify(entry.newValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
