import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { CalendarClock, CheckCircle2, Clock3, ScanLine, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SessionStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth/useAuth";
import { policyCol } from "@/firebase/firestore";
import { useStudentAttendance } from "../hooks/useStudentAttendance";
import { cn } from "@/lib/utils";

const DEFAULT_MIN_ATTENDANCE_PERCENT = 75;

export function StudentDashboardPage() {
  const { profile } = useAuth();
  const vm = useStudentAttendance();
  const [minPercent, setMinPercent] = useState(DEFAULT_MIN_ATTENDANCE_PERCENT);

  useEffect(() => {
    document.title = "Dashboard | Smart Attendance";
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(policyCol, "attendancePolicy"),
      (snap) => setMinPercent(snap.exists() ? snap.data().minAttendancePercent : DEFAULT_MIN_ATTENDANCE_PERCENT),
      () => setMinPercent(DEFAULT_MIN_ATTENDANCE_PERCENT)
    );
    return unsubscribe;
  }, []);

  if (vm.loading) return <LoadingSpinner fullScreen label="Loading your attendance..." />;

  const percentTone = vm.overallPercentage >= minPercent ? "success" : vm.overallPercentage >= minPercent - 10 ? "warning" : "destructive";
  const markedToday = vm.todaysMarkedSessionIds.size;
  const totalToday = vm.todaysSessions.length;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h2 className="text-xl font-semibold">{profile?.name ?? "My Attendance"}</h2>
        <p className="text-sm text-muted-foreground">
          {vm.studentRecord
            ? `Roll No. ${vm.studentRecord.rollNumber} · Semester ${vm.studentRecord.semester} · Division ${vm.studentRecord.divisionId}`
            : "Complete your student profile to see class details."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overall Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span
                className={cn(
                  "text-3xl font-bold tracking-tight",
                  percentTone === "success" && "text-success",
                  percentTone === "warning" && "text-warning",
                  percentTone === "destructive" && "text-destructive"
                )}
              >
                {vm.overallPercentage}%
              </span>
              <span className="text-xs text-muted-foreground">Minimum required: {minPercent}%</span>
            </div>
            <Progress
              value={vm.overallPercentage}
              indicatorClassName={cn(
                percentTone === "success" && "bg-success",
                percentTone === "warning" && "bg-warning",
                percentTone === "destructive" && "bg-destructive"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {vm.overallPresent} of {vm.overallTotal} classes attended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalToday === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions scheduled for today.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Marked {markedToday} of {totalToday} session{totalToday === 1 ? "" : "s"} today.
              </p>
            )}
            <Button asChild size="lg" className="w-full">
              <Link to="/student/attendance">
                <ScanLine className="mr-2 h-4 w-4" />
                Mark Attendance
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Present" value={vm.statusCounts.present} icon={CheckCircle2} tone="success" />
        <StatCard label="Absent" value={vm.statusCounts.absent} icon={XCircle} tone="destructive" />
        <StatCard label="Late" value={vm.statusCounts.late} icon={Clock3} tone="warning" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subject-wise Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {vm.subjectSummaries.length === 0 ? (
            <EmptyState title="No attendance recorded yet" description="Your subject-wise breakdown will appear here once you attend classes." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="min-w-[160px]">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vm.subjectSummaries.map((s) => {
                  const tone = s.percentage >= minPercent ? "success" : s.percentage >= minPercent - 10 ? "warning" : "destructive";
                  return (
                    <TableRow key={s.subjectId}>
                      <TableCell className="font-medium">{s.subjectName}</TableCell>
                      <TableCell className="text-right">{s.present}</TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={s.percentage}
                            className="h-2"
                            indicatorClassName={cn(
                              tone === "success" && "bg-success",
                              tone === "warning" && "bg-warning",
                              tone === "destructive" && "bg-destructive"
                            )}
                          />
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{s.percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today's Timetable</CardTitle>
        </CardHeader>
        <CardContent>
          {vm.todaysSessions.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No sessions today" description="Check back once your teacher schedules a class." />
          ) : (
            <div className="space-y-2">
              {vm.todaysSessions.map((session) => {
                const marked = vm.todaysMarkedSessionIds.has(session.sessionId);
                return (
                  <div
                    key={session.sessionId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{session.subjectName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.teacherName} ·{" "}
                        {new Date(session.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                        {new Date(session.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {marked ? <Badge variant="success">Marked</Badge> : <SessionStatusBadge status={session.status} />}
                      {session.status === "open" && !marked && (
                        <Button asChild size="sm">
                          <Link to="/student/attendance">Mark</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
