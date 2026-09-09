import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, GraduationCap, UserSquare2, BookOpen, PlayCircle, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDocs, query, where } from "firebase/firestore";
import { recordsCol } from "@/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  useDepartments,
  useClasses,
  useStudents,
  useTeachers,
  useActiveSessionsToday,
} from "../hooks/useAdminCollections";

interface DayPoint {
  day: string;
  present: number;
  absent: number;
}

/** Loads the last 7 days of attendance records and buckets them by day for the trend chart. */
function useWeeklyTrend() {
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 6);
        since.setHours(0, 0, 0, 0);
        const q = query(recordsCol, where("timestamp", ">=", since.toISOString()));
        const snap = await getDocs(q);
        const buckets = new Map<string, DayPoint>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString(undefined, { weekday: "short" });
          buckets.set(d.toDateString(), { day: key, present: 0, absent: 0 });
        }
        snap.docs.forEach((docSnap: (typeof snap.docs)[number]) => {
          const rec = docSnap.data();
          const d = new Date(rec.timestamp);
          const bucket = buckets.get(d.toDateString());
          if (!bucket) return;
          if (rec.status === "present" || rec.status === "late") bucket.present += 1;
          else if (rec.status === "absent") bucket.absent += 1;
        });
        if (!cancelled) setData(Array.from(buckets.values()));
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

export function AdminDashboardPage() {
  const { departments, loading: loadingDepts } = useDepartments();
  const { classes, loading: loadingClasses } = useClasses();
  const { students, loading: loadingStudents } = useStudents();
  const { teachers, loading: loadingTeachers } = useTeachers();
  const { count: activeSessions, loading: loadingSessions } = useActiveSessionsToday();
  const { data: trend, loading: loadingTrend } = useWeeklyTrend();

  useEffect(() => {
    document.title = "Admin Dashboard | Smart Attendance";
  }, []);

  const overallLoading = loadingDepts || loadingClasses || loadingStudents || loadingTeachers || loadingSessions;

  const todayPercent = useMemo(() => {
    const today = trend[trend.length - 1];
    if (!today) return 0;
    const total = today.present + today.absent;
    return total === 0 ? 0 : Math.round((today.present / total) * 1000) / 10;
  }, [trend]);

  if (overallLoading) return <LoadingSpinner fullScreen label="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Departments" value={departments.length} icon={Building2} />
        <StatCard label="Classes" value={classes.length} icon={BookOpen} />
        <StatCard label="Teachers" value={teachers.length} icon={UserSquare2} />
        <StatCard label="Students" value={students.length} icon={GraduationCap} tone="success" />
        <StatCard label="Active Sessions" value={activeSessions} icon={PlayCircle} tone={activeSessions > 0 ? "success" : "default"} />
        <StatCard label="Attendance Today" value={`${todayPercent}%`} icon={Percent} tone={todayPercent >= 75 ? "success" : "warning"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Weekly Attendance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrend ? (
            <LoadingSpinner label="Loading trend..." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="present" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Present" />
                  <Bar dataKey="absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 py-4">
          <Link to="/admin/departments">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-medium">Manage Departments</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 py-4">
          <Link to="/admin/classes">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-medium">Manage Classes & Subjects</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 py-4">
          <Link to="/admin/students">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-medium">Manage Students</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 py-4">
          <Link to="/admin/settings">
            <Percent className="h-5 w-5 text-primary" />
            <span className="font-medium">Attendance Policy</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
