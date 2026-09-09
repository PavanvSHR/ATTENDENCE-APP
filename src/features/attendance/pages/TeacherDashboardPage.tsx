/**
 * Teacher's home screen: today's numbers across every class they teach,
 * a "Start Attendance" call to action, recent sessions, and a weekly
 * present-count trend. All figures are computed from live Firestore
 * queries scoped to the signed-in teacher's userId — no server round trip
 * needed just to look at the dashboard.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onSnapshot, query, where } from "firebase/firestore";
import { format, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Percent, Plus, Radio, UserCheck, UserX, Users, Clock3, ChevronRight, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SessionStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/auth/useAuth";
import { recordsCol, sessionsCol, studentsCol } from "@/firebase/firestore";
import { useTeacherSubjects } from "@/features/classes/hooks/useClassOptions";
import type { AttendanceRecord, AttendanceSession } from "@/types";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const TODAY = format(new Date(), "yyyy-MM-dd");
const WEEK_START = format(subDays(new Date(), 6), "yyyy-MM-dd");

export function TeacherDashboardPage() {
  const { profile } = useAuth();
  const teacherId = profile?.userId;

  const { subjects, loading: subjectsLoading } = useTeacherSubjects(teacherId);

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);

  const divisionKey = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.divisionId))).sort().join(","),
    [subjects]
  );
  const divisionIds = useMemo(() => (divisionKey ? divisionKey.split(",") : []), [divisionKey]);

  useEffect(() => {
    document.title = "Teacher Dashboard | Smart Attendance";
  }, []);

  // This teacher's sessions, live.
  useEffect(() => {
    if (!teacherId) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }
    setSessionsLoading(true);
    const q = query(sessionsCol, where("teacherId", "==", teacherId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => d.data());
        data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setSessions(data);
        setSessionsLoading(false);
      },
      () => setSessionsLoading(false)
    );
    return unsubscribe;
  }, [teacherId]);

  // Total students across every division this teacher teaches, live.
  useEffect(() => {
    if (divisionIds.length === 0) {
      setTotalStudents(0);
      return;
    }
    const chunks = chunk(divisionIds, 10);
    const perChunkCounts = new Array(chunks.length).fill(0);
    const unsubscribes = chunks.map((ids, idx) =>
      onSnapshot(query(studentsCol, where("divisionId", "in", ids)), (snap) => {
        perChunkCounts[idx] = snap.size;
        setTotalStudents(perChunkCounts.reduce((a: number, b: number) => a + b, 0));
      })
    );
    return () => unsubscribes.forEach((u) => u());
  }, [divisionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attendance records for this week's sessions, live — powers today's
  // counts and the weekly trend chart.
  const weekSessionIds = useMemo(
    () => sessions.filter((s) => s.date >= WEEK_START && s.date <= TODAY).map((s) => s.sessionId),
    [sessions]
  );
  const weekSessionKey = useMemo(() => weekSessionIds.slice().sort().join(","), [weekSessionIds]);

  useEffect(() => {
    if (weekSessionIds.length === 0) {
      setWeekRecords([]);
      return;
    }
    const chunks = chunk(weekSessionIds, 10);
    const perChunk: AttendanceRecord[][] = new Array(chunks.length).fill([]);
    const unsubscribes = chunks.map((ids, idx) =>
      onSnapshot(query(recordsCol, where("sessionId", "in", ids)), (snap) => {
        perChunk[idx] = snap.docs.map((d) => d.data());
        setWeekRecords(perChunk.flat());
      })
    );
    return () => unsubscribes.forEach((u) => u());
  }, [weekSessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionDateById = useMemo(() => new Map(sessions.map((s) => [s.sessionId, s.date])), [sessions]);

  const todayRecords = useMemo(
    () => weekRecords.filter((r) => sessionDateById.get(r.sessionId) === TODAY),
    [weekRecords, sessionDateById]
  );
  const presentToday = todayRecords.filter((r) => r.status === "present").length;
  const absentToday = todayRecords.filter((r) => r.status === "absent").length;
  const lateToday = todayRecords.filter((r) => r.status === "late").length;
  const activeSessions = sessions.filter((s) => s.status === "open").length;
  const attendancePercentToday =
    todayRecords.length > 0 ? Math.round(((presentToday + lateToday) / todayRecords.length) * 1000) / 10 : 0;

  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));
    return days.map((day) => {
      const dayRecords = weekRecords.filter((r) => sessionDateById.get(r.sessionId) === day);
      const present = dayRecords.filter((r) => r.status === "present" || r.status === "late").length;
      return { day: format(new Date(day), "EEE"), present };
    });
  }, [weekRecords, sessionDateById]);

  const recentSessions = sessions.slice(0, 5);
  const loading = subjectsLoading || sessionsLoading;

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Welcome, {profile?.name ?? "Teacher"}</h2>
          <p className="text-sm text-muted-foreground">Today's attendance across your classes.</p>
        </div>
        <Button asChild size="lg">
          <Link to="/teacher/sessions/new">
            <Plus className="h-4 w-4" /> Start Attendance
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Students" value={totalStudents} icon={Users} />
        <StatCard label="Present Today" value={presentToday} icon={UserCheck} tone="success" />
        <StatCard label="Absent Today" value={absentToday} icon={UserX} tone="destructive" />
        <StatCard label="Late Today" value={lateToday} icon={Clock3} tone="warning" />
        <StatCard label="Active Sessions" value={activeSessions} icon={Radio} />
        <StatCard label="Attendance % Today" value={`${attendancePercentToday}%`} icon={Percent} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">This week's present count</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.every((d) => d.present === 0) ? (
              <EmptyState
                icon={CalendarClock}
                title="No attendance yet this week"
                description="Start a session to see the trend build up here."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "0.75rem",
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSessions.length === 0 ? (
              <EmptyState title="No sessions yet" description="Sessions you start will show up here." />
            ) : (
              recentSessions.map((s) => (
                <Link
                  key={s.sessionId}
                  to={`/teacher/sessions/${s.sessionId}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.subjectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.date} &middot; {s.startTime.slice(11, 16) || s.startTime}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SessionStatusBadge status={s.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
