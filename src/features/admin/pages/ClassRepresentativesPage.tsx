import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Star, UserCheck, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/useAuth";
import { useClasses, useDivisions, useStudents } from "../hooks/useAdminCollections";
import { promoteToClassRepresentative, revokeClassRepresentative } from "../services/adminDataService";
import { classRepresentativeSchema, type ClassRepresentativeInput } from "@/schemas/class.schema";

export function ClassRepresentativesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { classes, loading: classesLoading } = useClasses();
  const { divisions: allDivisions, loading: divisionsLoading } = useDivisions();
  const { students, loading: studentsLoading } = useStudents();

  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Class Representatives | Smart Attendance";
  }, []);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClassRepresentativeInput>({
    resolver: zodResolver(classRepresentativeSchema),
    defaultValues: { studentId: "", divisionId: "", authorizedByUserId: profile?.userId ?? "" },
  });

  const [formClassId, setFormClassId] = useState("");
  const formDivisionId = watch("divisionId");
  const { divisions: formDivisions } = useDivisions(formClassId || undefined);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.studentId, s])), [students]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.classId, c])), [classes]);

  const eligibleStudents = useMemo(() => {
    if (!formDivisionId) return [];
    const division = formDivisions.find((d) => d.divisionId === formDivisionId);
    const existingCrIds = new Set(division?.classRepresentativeIds ?? []);
    return students.filter((s) => s.divisionId === formDivisionId && !existingCrIds.has(s.studentId));
  }, [formDivisionId, formDivisions, students]);

  const selectedStudentId = watch("studentId");
  const selectedStudent = selectedStudentId ? studentMap.get(selectedStudentId) : undefined;

  async function onSubmit(values: ClassRepresentativeInput) {
    if (!profile) return;
    setSubmitting(true);
    try {
      const student = studentMap.get(values.studentId);
      await promoteToClassRepresentative(
        { ...values, authorizedByUserId: profile.userId },
        student?.userId || undefined
      );
      toast({
        title: "Class Representative assigned",
        description: student?.userId
          ? `${student.name} is now CR and their account role was updated.`
          : `${student?.name} is now recorded as CR. Their account role will update automatically once they sign in.`,
      });
      reset({ studentId: "", divisionId: "", authorizedByUserId: profile.userId });
      setFormClassId("");
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(divisionId: string, studentId: string) {
    const student = studentMap.get(studentId);
    setRevoking(`${divisionId}:${studentId}`);
    try {
      await revokeClassRepresentative(divisionId, studentId, student?.userId || undefined);
      toast({ title: "CR revoked", description: `${student?.name ?? "Student"} is no longer a Class Representative.` });
    } catch (err) {
      toast({
        title: "Couldn't revoke CR",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRevoking(null);
    }
  }

  const loading = classesLoading || divisionsLoading || studentsLoading;
  const divisionsWithCrs = allDivisions.filter((d) => d.classRepresentativeIds.length > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Class Representatives</h2>
        <p className="text-sm text-muted-foreground">Promote a student to CR for their division, or revoke an existing one.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assign a Class Representative</CardTitle>
          <CardDescription>Pick a division, then a student within it, to promote.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={formClassId}
                  onValueChange={(value) => {
                    setFormClassId(value);
                    setValue("divisionId", "");
                    setValue("studentId", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.classId} value={c.classId}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Controller
                  control={control}
                  name="divisionId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("studentId", "");
                      }}
                      disabled={!formClassId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formClassId ? "Select division" : "Select a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formDivisions.map((d) => (
                          <SelectItem key={d.divisionId} value={d.divisionId}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.divisionId && <p className="text-sm text-destructive">{errors.divisionId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Student</Label>
                <Controller
                  control={control}
                  name="studentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!formDivisionId}>
                      <SelectTrigger>
                        <SelectValue placeholder={formDivisionId ? "Select student" : "Select a division first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleStudents.length === 0 && (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">No eligible students.</p>
                        )}
                        {eligibleStudents.map((s) => (
                          <SelectItem key={s.studentId} value={s.studentId}>
                            {s.name} ({s.rollNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.studentId && <p className="text-sm text-destructive">{errors.studentId.message}</p>}
              </div>
            </div>

            {selectedStudent && !selectedStudent.userId && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>
                  <span className="font-medium">{selectedStudent.name}</span> hasn't signed in yet, so there's no linked
                  login account to promote. They'll still be recorded as CR for this division now, and their account
                  role will be set to CR automatically the first time they sign in.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || !formDivisionId}>
                <Star className="mr-2 h-4 w-4" />
                {submitting ? "Assigning..." : "Assign as CR"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Class Representatives</CardTitle>
          <CardDescription>Grouped by division. Revoke to remove CR status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner label="Loading..." />
          ) : divisionsWithCrs.length === 0 ? (
            <EmptyState icon={Users} title="No Class Representatives yet" description="Assign one using the form above." />
          ) : (
            <div className="space-y-3">
              {divisionsWithCrs.map((division) => {
                const cls = classMap.get(division.classId);
                return (
                  <div key={division.divisionId} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <p className="font-medium">
                        {cls?.name ?? "Unknown class"} — Division {division.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {division.classRepresentativeIds.map((studentId) => {
                        const student = studentMap.get(studentId);
                        const key = `${division.divisionId}:${studentId}`;
                        return (
                          <Badge key={studentId} variant="secondary" className="gap-1.5 py-1.5 pl-2.5 pr-1.5">
                            {student?.name ?? "Unknown student"}
                            {student?.rollNumber && <span className="text-muted-foreground">({student.rollNumber})</span>}
                            <button
                              type="button"
                              onClick={() => handleRevoke(division.divisionId, studentId)}
                              disabled={revoking === key}
                              aria-label={`Revoke CR for ${student?.name ?? studentId}`}
                              className="ml-1 rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
                              title="Revoke CR"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        );
                      })}
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
