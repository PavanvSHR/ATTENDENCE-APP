import { useEffect, useMemo, useState } from "react";
import { getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { ClipboardList, FileDown, FileSpreadsheet, FileText, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { AttendanceStatusBadge } from "@/components/common/StatusBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { useAuth } from "@/auth/useAuth";
import { classesCol, divisionsCol, subjectsCol, teachersCol, studentsCol } from "@/firebase/firestore";
import type { AttendanceStatus, AttendanceVerification, ClassRecord, Division, StudentRecord, Subject, TeacherRecord } from "@/types";
import {
  fetchClassAttendance,
  fetchDailyAttendance,
  fetchDefaultersList,
  fetchLateAttendance,
  fetchMonthlyAttendance,
  fetchStudentAttendance,
  fetchSubjectAttendance,
  fetchVerificationFailures,
  resolveTeacherId,
  type DefaulterRow,
  type ReportFilters,
  type ReportRow,
} from "../services/reportService";
import { exportToCsv, exportToPdf, exportToXlsx, type TabularData } from "@/utils/export";

type ReportTab = "daily" | "monthly" | "student" | "subject" | "class" | "defaulters" | "late" | "verification";

const TAB_LABELS: Record<ReportTab, string> = {
  daily: "Daily",
  monthly: "Monthly",
  student: "Student",
  subject: "Subject",
  class: "Class",
  defaulters: "Defaulters",
  late: "Late",
  verification: "Verification Failures",
};

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const ALL = "all";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}
function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function failedVerificationMethods(v: AttendanceVerification): string {
  const failed: string[] = [];
  if (v.biometric === "failed") failed.push("Biometric");
  if (v.face === "failed") failed.push("Face");
  if (v.location === "failed") failed.push("Location");
  if (v.qr === "failed") failed.push("QR");
  return failed.join(", ") || "—";
}

export function ReportsPage() {
  const { profile } = useAuth();
  const isTeacher = profile?.role === "teacher";

  const [tab, setTab] = useState<ReportTab>("daily");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [defaulterRows, setDefaulterRows] = useState<DefaulterRow[]>([]);

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  const [classId, setClassId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState(currentMonthIso());
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [studentId, setStudentId] = useState("");
  const [thresholdPercent, setThresholdPercent] = useState(75);

  // Reference data for filter dropdowns — loaded once.
  useEffect(() => {
    (async () => {
      const [classesSnap, divisionsSnap, subjectsSnap, teachersSnap] = await Promise.all([
        getDocs(classesCol),
        getDocs(divisionsCol),
        getDocs(subjectsCol),
        getDocs(teachersCol),
      ]);
      setClasses(classesSnap.docs.map((d) => d.data()));
      setDivisions(divisionsSnap.docs.map((d) => d.data()));
      setSubjects(subjectsSnap.docs.map((d) => d.data()));
      setTeachers(teachersSnap.docs.map((d) => d.data()));
    })();
  }, []);

  // Teachers can only generate/export their own attendance reports — default (and
  // effectively lock, by never rendering the teacher selector) to their own record.
  useEffect(() => {
    if (isTeacher && profile?.userId) {
      resolveTeacherId(profile.userId).then((id) => {
        if (id) setTeacherId(id);
      });
    }
  }, [isTeacher, profile?.userId]);

  // Students available to pick from on the Student tab, scoped by class/division if chosen.
  useEffect(() => {
    if (tab !== "student") return;
    (async () => {
      const clauses: QueryConstraint[] = [];
      if (classId) clauses.push(where("classId", "==", classId));
      if (divisionId) clauses.push(where("divisionId", "==", divisionId));
      const snap = await getDocs(query(studentsCol, ...clauses));
      setStudents(snap.docs.map((d) => d.data()));
    })();
  }, [tab, classId, divisionId]);

  const filteredDivisions = useMemo(
    () => (classId ? divisions.filter((d) => d.classId === classId) : divisions),
    [divisions, classId]
  );
  const filteredSubjects = useMemo(
    () =>
      subjects.filter(
        (s) => (classId ? s.classId === classId : true) && (divisionId ? s.divisionId === divisionId : true)
      ),
    [subjects, classId, divisionId]
  );

  const filters: ReportFilters = useMemo(
    () => ({
      classId: classId || undefined,
      divisionId: divisionId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [classId, divisionId, subjectId, teacherId, status, from, to]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (tab === "defaulters") {
          const data = await fetchDefaultersList(thresholdPercent, filters);
          if (cancelled) return;
          setDefaulterRows(data);
          setRows([]);
          return;
        }
        let data: ReportRow[] = [];
        switch (tab) {
          case "daily":
            data = await fetchDailyAttendance(date, filters);
            break;
          case "monthly":
            data = await fetchMonthlyAttendance(month, filters);
            break;
          case "student":
            data = studentId ? await fetchStudentAttendance(studentId, filters) : [];
            break;
          case "subject":
            data = subjectId ? await fetchSubjectAttendance(subjectId, filters) : [];
            break;
          case "class":
            data = classId ? await fetchClassAttendance(classId, divisionId || undefined, filters) : [];
            break;
          case "late":
            data = await fetchLateAttendance(filters);
            break;
          case "verification":
            data = await fetchVerificationFailures(filters);
            break;
        }
        if (cancelled) return;
        setRows(data);
        setDefaulterRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, filters, date, month, studentId, thresholdPercent, classId, divisionId, subjectId]);

  const classNameOf = (id: string) => classes.find((c) => c.classId === id)?.name ?? id;
  const divisionNameOf = (id: string) => divisions.find((d) => d.divisionId === id)?.name ?? id;

  const currentCount = tab === "defaulters" ? defaulterRows.length : rows.length;
  const isEmpty = !loading && currentCount === 0;

  function buildTabularData(): TabularData {
    if (tab === "defaulters") {
      return {
        headers: ["Roll No", "Student", "Class", "Division", "Sessions", "Present", "Late", "Absent", "Excused", "Percentage"],
        rows: defaulterRows.map((r) => [
          r.rollNumber,
          r.studentName,
          classNameOf(r.classId),
          divisionNameOf(r.divisionId),
          r.totalSessions,
          r.presentCount,
          r.lateCount,
          r.absentCount,
          r.excusedCount,
          `${r.percentage}%`,
        ]),
      };
    }
    const headers = ["Date", "Roll No", "Student", "Class", "Division", "Subject", "Teacher", "Status", "Risk", "Flagged"];
    if (tab === "verification") headers.push("Failed Methods");
    return {
      headers,
      rows: rows.map((r) => {
        const base: (string | number)[] = [
          r.date,
          r.rollNumber,
          r.studentName,
          classNameOf(r.classId),
          divisionNameOf(r.divisionId),
          r.subjectName,
          r.teacherName,
          r.status,
          r.riskLevel,
          r.flaggedForReview ? "Yes" : "No",
        ];
        if (tab === "verification") base.push(failedVerificationMethods(r.verification));
        return base;
      }),
    };
  }

  function filenameBase(): string {
    return `${TAB_LABELS[tab].toLowerCase().replace(/\s+/g, "-")}-attendance-report`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate, filter, and export attendance reports.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
        <TabsList className="flex-wrap">
          {(Object.keys(TAB_LABELS) as ReportTab[]).map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tab === "daily" && (
            <div className="space-y-1.5">
              <Label htmlFor="report-date">Date</Label>
              <Input id="report-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {tab === "monthly" && (
            <div className="space-y-1.5">
              <Label htmlFor="report-month">Month</Label>
              <Input id="report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          )}
          {tab !== "daily" && tab !== "monthly" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="report-from">From</Label>
                <Input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to">To</Label>
                <Input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select
              value={classId || ALL}
              onValueChange={(v) => {
                setClassId(v === ALL ? "" : v);
                setDivisionId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Division</Label>
            <Select value={divisionId || ALL} onValueChange={(v) => setDivisionId(v === ALL ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All divisions</SelectItem>
                {filteredDivisions.map((d) => (
                  <SelectItem key={d.divisionId} value={d.divisionId}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId || ALL} onValueChange={(v) => setSubjectId(v === ALL ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All subjects</SelectItem>
                {filteredSubjects.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isTeacher && (
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select value={teacherId || ALL} onValueChange={(v) => setTeacherId(v === ALL ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All teachers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All teachers</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.teacherId} value={t.teacherId}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tab !== "late" && tab !== "verification" && tab !== "defaulters" && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : (v as AttendanceStatus))}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tab === "student" && (
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId || ALL} onValueChange={(v) => setStudentId(v === ALL ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Select a student</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.studentId} value={s.studentId}>
                      {s.rollNumber} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tab === "defaulters" && (
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Below % threshold</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                max={100}
                value={thresholdPercent}
                onChange={(e) => setThresholdPercent(Number(e.target.value))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{TAB_LABELS[tab]} Report</CardTitle>
            <Badge variant="secondary">{currentCount} records</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isEmpty} onClick={() => exportToCsv(filenameBase(), buildTabularData())}>
              <FileDown className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={isEmpty} onClick={() => exportToXlsx(filenameBase(), buildTabularData())}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isEmpty}
              onClick={() => exportToPdf(filenameBase(), `${TAB_LABELS[tab]} Attendance Report`, buildTabularData())}
            >
              <FileText className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner label="Loading report..." />
          ) : isEmpty ? (
            <EmptyState
              icon={ClipboardList}
              title="No records found"
              description="Try widening the date range or clearing some filters."
            />
          ) : tab === "defaulters" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaulterRows.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell>{r.rollNumber}</TableCell>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell>{classNameOf(r.classId)}</TableCell>
                    <TableCell>{divisionNameOf(r.divisionId)}</TableCell>
                    <TableCell>{r.totalSessions}</TableCell>
                    <TableCell>{r.presentCount}</TableCell>
                    <TableCell>{r.lateCount}</TableCell>
                    <TableCell>{r.absentCount}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{r.percentage}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  {tab === "verification" && <TableHead>Failed Methods</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.recordId}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.rollNumber}</TableCell>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell>
                      {classNameOf(r.classId)} {divisionNameOf(r.divisionId)}
                    </TableCell>
                    <TableCell>{r.subjectName}</TableCell>
                    <TableCell>{r.teacherName}</TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={r.riskLevel} />
                    </TableCell>
                    {tab === "verification" && <TableCell>{failedVerificationMethods(r.verification)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
