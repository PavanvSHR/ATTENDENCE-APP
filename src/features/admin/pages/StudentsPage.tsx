import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AccountStatusBadge } from "@/components/common/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useClasses, useDivisions, useStudents } from "../hooks/useAdminCollections";
import { createStudent, updateStudent, deleteStudent, setStudentStatus } from "../services/adminDataService";
import { studentSchema, type StudentInput } from "@/schemas/class.schema";
import type { StudentRecord } from "@/types";
import { cn } from "@/lib/utils";

export function StudentsPage() {
  const { classes } = useClasses();
  const { toast } = useToast();

  const [classFilter, setClassFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { divisions: filterDivisions } = useDivisions(classFilter !== "all" ? classFilter : undefined);
  const { students, loading } = useStudents({
    classId: classFilter !== "all" ? classFilter : undefined,
    divisionId: divisionFilter !== "all" ? divisionFilter : undefined,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Students | Smart Attendance";
  }, []);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.classId, c])), [classes]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      collegeEmail: "",
      phone: "",
      rollNumber: "",
      enrollmentNumber: "",
      classId: "",
      divisionId: "",
      academicYear: "",
      semester: 1,
    },
  });

  const formClassId = watch("classId");
  const { divisions: formDivisions } = useDivisions(formClassId || undefined);

  function openCreate() {
    setEditing(null);
    reset({
      name: "",
      collegeEmail: "",
      phone: "",
      rollNumber: "",
      enrollmentNumber: "",
      classId: classFilter !== "all" ? classFilter : "",
      divisionId: "",
      academicYear: "",
      semester: 1,
    });
    setDialogOpen(true);
  }

  function openEdit(student: StudentRecord) {
    setEditing(student);
    reset({
      name: student.name,
      collegeEmail: student.collegeEmail,
      phone: student.phone ?? "",
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber,
      classId: student.classId,
      divisionId: student.divisionId,
      academicYear: student.academicYear,
      semester: student.semester,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: StudentInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateStudent(editing.studentId, values);
        toast({ title: "Student updated", description: `${values.name} saved.` });
      } else {
        await createStudent(values);
        toast({ title: "Student added", description: `${values.name} added.` });
      }
      setDialogOpen(false);
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteStudent(deleteTarget.studentId);
      toast({ title: "Student removed", description: `${deleteTarget.name} removed.` });
    } catch (err) {
      toast({
        title: "Couldn't remove student",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function toggleStatus(student: StudentRecord) {
    const next = student.status === "disabled" ? "active" : "disabled";
    try {
      await setStudentStatus(student.studentId, next);
      toast({ title: next === "disabled" ? "Student disabled" : "Student enabled", description: student.name });
    } catch (err) {
      toast({
        title: "Couldn't update status",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        s.collegeEmail.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Students</h2>
          <p className="text-sm text-muted-foreground">Enrolled students across all classes and divisions.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, roll no, enrollment no..."
                className="pl-9"
              />
            </div>
            <Select
              value={classFilter}
              onValueChange={(v) => {
                setClassFilter(v);
                setDivisionFilter("all");
              }}
            >
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={divisionFilter} onValueChange={setDivisionFilter} disabled={classFilter === "all"}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="All divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All divisions</SelectItem>
                {filterDivisions.map((d) => (
                  <SelectItem key={d.divisionId} value={d.divisionId}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner label="Loading students..." />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description="Try adjusting your filters, or add a new student."
              action={
                <Button onClick={openCreate} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Student
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">
                      {student.name}
                      <div className="text-xs font-normal text-muted-foreground">{student.collegeEmail}</div>
                    </TableCell>
                    <TableCell>{student.rollNumber}</TableCell>
                    <TableCell>{classMap.get(student.classId)?.name ?? "—"}</TableCell>
                    <TableCell>
                      <AccountStatusBadge status={student.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={student.faceEnrolled ? "success" : "outline"} className="text-[10px]">
                          {student.faceEnrolled ? "Face enrolled" : "Face not enrolled"}
                        </Badge>
                        <Badge variant={student.biometricRegistered ? "success" : "outline"} className="text-[10px]">
                          {student.biometricRegistered ? "Biometric set" : "Not enrolled"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {student.registeredDeviceIds.length} device{student.registeredDeviceIds.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatus(student)}
                          aria-label={student.status === "disabled" ? `Enable ${student.name}` : `Disable ${student.name}`}
                          title={student.status === "disabled" ? "Enable account" : "Disable account"}
                        >
                          <Power className={cn("h-4 w-4", student.status === "disabled" ? "text-success" : "text-warning")} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(student)} aria-label={`Edit ${student.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(student)}
                          aria-label={`Remove ${student.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this student's details." : "Create a new student record."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="studentName">Full name</Label>
                <Input id="studentName" placeholder="Rohan Sharma" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="collegeEmail">College email</Label>
                <Input id="collegeEmail" type="email" placeholder="rohan.sharma@college.edu" {...register("collegeEmail")} />
                {errors.collegeEmail && <p className="text-sm text-destructive">{errors.collegeEmail.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" placeholder="+91 98765 43210" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll number</Label>
                <Input id="rollNumber" placeholder="42" {...register("rollNumber")} />
                {errors.rollNumber && <p className="text-sm text-destructive">{errors.rollNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollmentNumber">Enrollment number</Label>
                <Input id="enrollmentNumber" placeholder="EN2026001" {...register("enrollmentNumber")} />
                {errors.enrollmentNumber && <p className="text-sm text-destructive">{errors.enrollmentNumber.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Class</Label>
                <Controller
                  control={control}
                  name="classId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("divisionId", "");
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
                  )}
                />
                {errors.classId && <p className="text-sm text-destructive">{errors.classId.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Division</Label>
                <Controller
                  control={control}
                  name="divisionId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!formClassId}>
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
                <Label htmlFor="academicYear">Academic year</Label>
                <Input id="academicYear" placeholder="2026-2027" {...register("academicYear")} />
                {errors.academicYear && <p className="text-sm text-destructive">{errors.academicYear.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semester</Label>
                <Input id="semester" type="number" min={1} max={12} {...register("semester")} />
                {errors.semester && <p className="text-sm text-destructive">{errors.semester.message}</p>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground rounded-md bg-muted p-2.5">
              Login account will be created when this person first signs in with Google, or provisioned via the backend
              admin API (see docs).
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editing ? "Save Changes" : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove student?"
        description={`This will permanently remove "${deleteTarget?.name}" and their attendance history references. This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
