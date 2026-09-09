import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, UserSquare2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AccountStatusBadge } from "@/components/common/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useTeachers, useDepartments, useSubjects } from "../hooks/useAdminCollections";
import {
  createTeacher,
  updateTeacher,
  deleteTeacher,
  setTeacherStatus,
  type TeacherRecordExt,
} from "../services/adminDataService";
import { teacherSchema, type TeacherInput } from "@/schemas/class.schema";

export function TeachersPage() {
  const { teachers, loading } = useTeachers();
  const { departments } = useDepartments();
  const { subjects } = useSubjects();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRecordExt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherRecordExt | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Teachers | Smart Attendance";
  }, []);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TeacherInput>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { name: "", email: "", departmentId: "", subjectIds: [] },
  });

  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.departmentId, d])), [departments]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.subjectId, s])), [subjects]);

  function openCreate() {
    setEditing(null);
    reset({ name: "", email: "", departmentId: "", subjectIds: [] });
    setDialogOpen(true);
  }

  function openEdit(teacher: TeacherRecordExt) {
    setEditing(teacher);
    reset({
      name: teacher.name,
      email: teacher.email ?? "",
      departmentId: teacher.departmentId,
      subjectIds: teacher.subjectIds ?? [],
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: TeacherInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateTeacher(editing.teacherId, values);
        toast({ title: "Teacher updated", description: `${values.name} saved.` });
      } else {
        await createTeacher(values);
        toast({ title: "Teacher added", description: `${values.name} added.` });
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
      await deleteTeacher(deleteTarget.teacherId);
      toast({ title: "Teacher removed", description: `${deleteTarget.name} removed.` });
    } catch (err) {
      toast({
        title: "Couldn't remove teacher",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function toggleStatus(teacher: TeacherRecordExt) {
    const next = teacher.status === "disabled" ? "active" : "disabled";
    try {
      await setTeacherStatus(teacher.teacherId, next);
      toast({ title: next === "disabled" ? "Teacher disabled" : "Teacher enabled", description: teacher.name });
    } catch (err) {
      toast({
        title: "Couldn't update status",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const selectedSubjectIds = watch("subjectIds") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Teachers</h2>
          <p className="text-sm text-muted-foreground">Faculty accounts and their subject assignments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Teacher
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner label="Loading teachers..." />
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={UserSquare2}
              title="No teachers yet"
              description="Add a teacher and assign them to a department and subjects."
              action={
                <Button onClick={openCreate} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Teacher
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.teacherId}>
                    <TableCell className="font-medium">
                      {teacher.name}
                      {teacher.email && <div className="text-xs font-normal text-muted-foreground">{teacher.email}</div>}
                    </TableCell>
                    <TableCell>{departmentMap.get(teacher.departmentId)?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[16rem]">
                        {teacher.subjectIds.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None assigned</span>
                        ) : (
                          teacher.subjectIds.map((id) => (
                            <Badge key={id} variant="secondary">
                              {subjectMap.get(id)?.name ?? id}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AccountStatusBadge status={teacher.status ?? "pending"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatus(teacher)}
                          aria-label={teacher.status === "disabled" ? `Enable ${teacher.name}` : `Disable ${teacher.name}`}
                          title={teacher.status === "disabled" ? "Enable account" : "Disable account"}
                        >
                          <Power className={teacher.status === "disabled" ? "h-4 w-4 text-success" : "h-4 w-4 text-warning"} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(teacher)} aria-label={`Edit ${teacher.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(teacher)}
                          aria-label={`Remove ${teacher.name}`}
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
            <DialogTitle>{editing ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this teacher's details." : "Create a new teacher record."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Dr. Asha Patil" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">College email</Label>
              <Input id="email" type="email" placeholder="asha.patil@college.edu" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.departmentId} value={d.departmentId}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId && <p className="text-sm text-destructive">{errors.departmentId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Subjects</Label>
              <Controller
                control={control}
                name="subjectIds"
                render={({ field }) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start font-normal">
                        {selectedSubjectIds.length > 0
                          ? `${selectedSubjectIds.length} subject${selectedSubjectIds.length > 1 ? "s" : ""} selected`
                          : "Select subjects"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 max-h-64 overflow-y-auto">
                      {subjects.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No subjects created yet.</p>
                      ) : (
                        subjects.map((s) => (
                          <DropdownMenuCheckboxItem
                            key={s.subjectId}
                            checked={field.value?.includes(s.subjectId)}
                            onCheckedChange={(checked) => {
                              const current = field.value ?? [];
                              field.onChange(
                                checked ? [...current, s.subjectId] : current.filter((id) => id !== s.subjectId)
                              );
                            }}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {s.name} ({s.code})
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editing ? "Save Changes" : "Add Teacher"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove teacher?"
        description={`This will permanently remove "${deleteTarget?.name}" and unassign them from any subjects. This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
