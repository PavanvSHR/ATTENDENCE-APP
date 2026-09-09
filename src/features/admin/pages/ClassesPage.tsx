import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/components/ui/use-toast";
import { useClasses, useDepartments, useDivisions, useSubjects, useTeachers } from "../hooks/useAdminCollections";
import {
  createClass,
  updateClass,
  deleteClass,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../services/adminDataService";
import { classSchema, type ClassInput, subjectSchema, type SubjectInput } from "@/schemas/class.schema";
import type { ClassRecord, Subject } from "@/types";

function DivisionsTagInput({ control }: { control: Control<ClassInput> }) {
  const [draft, setDraft] = useState("");
  return (
    <Controller
      control={control}
      name="divisions"
      render={({ field, fieldState }) => {
        const values = field.value ?? [];
        function add() {
          const v = draft.trim().toUpperCase();
          if (v && !values.includes(v)) {
            field.onChange([...values, v]);
          }
          setDraft("");
        }
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. A"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={add}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {values.length === 0 && <p className="text-xs text-muted-foreground">No divisions added yet.</p>}
              {values.map((v: string) => (
                <Badge key={v} variant="secondary" className="gap-1 py-1">
                  {v}
                  <button
                    type="button"
                    onClick={() => field.onChange(values.filter((x: string) => x !== v))}
                    aria-label={`Remove division ${v}`}
                    className="ml-0.5 rounded-full hover:bg-black/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
          </div>
        );
      }}
    />
  );
}

function ClassesTab() {
  const { classes, loading } = useClasses();
  const { departments } = useDepartments();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.departmentId, d])), [departments]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassInput>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: "", departmentId: "", academicYear: "", semester: 1, divisions: [] },
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", departmentId: "", academicYear: "", semester: 1, divisions: [] });
    setDialogOpen(true);
  }

  function openEdit(cls: ClassRecord) {
    setEditing(cls);
    reset({
      name: cls.name,
      departmentId: cls.departmentId,
      academicYear: cls.academicYear,
      semester: cls.semester,
      divisions: cls.divisions,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: ClassInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateClass(editing.classId, values);
        toast({ title: "Class updated", description: `${values.name} saved.` });
      } else {
        await createClass(values);
        toast({ title: "Class created", description: `${values.name} added.` });
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
      await deleteClass(deleteTarget.classId);
      toast({ title: "Class deleted", description: `${deleteTarget.name} removed.` });
    } catch (err) {
      toast({
        title: "Couldn't delete class",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <CardTitle className="text-base">All Classes</CardTitle>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Class
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner label="Loading classes..." />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            description="Create a class and its divisions to start assigning subjects."
            action={
              <Button onClick={openCreate} size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Class
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Divisions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.classId}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{departmentMap.get(cls.departmentId)?.name ?? "—"}</TableCell>
                  <TableCell>{cls.academicYear}</TableCell>
                  <TableCell>{cls.semester}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cls.divisions.map((d) => (
                        <Badge key={d} variant="outline">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cls)} aria-label={`Edit ${cls.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cls)} aria-label={`Delete ${cls.name}`}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Class" : "Add Class"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this class's details." : "Create a class and its divisions."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class name</Label>
              <Input id="name" placeholder="B.Tech CSE 2nd Year" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>Divisions</Label>
              <DivisionsTagInput control={control} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editing ? "Save Changes" : "Create Class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete class?"
        description={`This will permanently remove "${deleteTarget?.name}" and its divisions. Students/subjects referencing it will need to be reassigned.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

function SubjectsTab() {
  const { classes } = useClasses();
  const { teachers } = useTeachers();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const { divisions } = useDivisions(selectedClassId || undefined);
  const { subjects, loading } = useSubjects(selectedClassId || undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const divisionMap = useMemo(() => new Map(divisions.map((d) => [d.divisionId, d])), [divisions]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.teacherId, t])), [teachers]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SubjectInput>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: "", code: "", classId: "", divisionId: "", teacherIds: [] },
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", code: "", classId: selectedClassId, divisionId: "", teacherIds: [] });
    setDialogOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    reset({
      name: subject.name,
      code: subject.code,
      classId: subject.classId,
      divisionId: subject.divisionId,
      teacherIds: subject.teacherIds,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: SubjectInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateSubject(editing.subjectId, values);
        toast({ title: "Subject updated", description: `${values.name} saved.` });
      } else {
        await createSubject(values);
        toast({ title: "Subject created", description: `${values.name} added.` });
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
      await deleteSubject(deleteTarget.subjectId);
      toast({ title: "Subject deleted", description: `${deleteTarget.name} removed.` });
    } catch (err) {
      toast({
        title: "Couldn't delete subject",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  const formClassId = watch("classId");
  const { divisions: formDivisions } = useDivisions(formClassId || undefined);
  const selectedTeacherIds = watch("teacherIds") ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Subjects</CardTitle>
          <p className="text-sm text-muted-foreground">Filter by class to manage its subjects and teacher assignments.</p>
        </div>
        <Button onClick={openCreate} size="sm" disabled={classes.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Add Subject
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-2">
          <Label>Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger>
              <SelectValue placeholder="All classes" />
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

        {loading ? (
          <LoadingSpinner label="Loading subjects..." />
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No subjects yet"
            description={selectedClassId ? "Add a subject for this class." : "Select a class, then add its subjects."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.subjectId}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.code}</TableCell>
                  <TableCell>{divisionMap.get(subject.divisionId)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[16rem]">
                      {subject.teacherIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      ) : (
                        subject.teacherIds.map((id) => (
                          <Badge key={id} variant="secondary">
                            {teacherMap.get(id)?.name ?? id}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(subject)} aria-label={`Edit ${subject.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(subject)}
                        aria-label={`Delete ${subject.name}`}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this subject's details." : "Create a subject under a class division."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subjectName">Subject name</Label>
              <Input id="subjectName" placeholder="Data Structures" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectCode">Code</Label>
              <Input id="subjectCode" placeholder="CS201" {...register("code")} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
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
              <Label>Teachers</Label>
              <Controller
                control={control}
                name="teacherIds"
                render={({ field }) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start font-normal">
                        {selectedTeacherIds.length > 0
                          ? `${selectedTeacherIds.length} teacher${selectedTeacherIds.length > 1 ? "s" : ""} selected`
                          : "Select teachers"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 max-h-64 overflow-y-auto">
                      {teachers.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No teachers created yet.</p>
                      ) : (
                        teachers.map((t) => (
                          <DropdownMenuCheckboxItem
                            key={t.teacherId}
                            checked={field.value?.includes(t.teacherId)}
                            onCheckedChange={(checked) => {
                              const current = field.value ?? [];
                              field.onChange(checked ? [...current, t.teacherId] : current.filter((id) => id !== t.teacherId));
                            }}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {t.name}
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
                {submitting ? "Saving..." : editing ? "Save Changes" : "Create Subject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete subject?"
        description={`This will permanently remove "${deleteTarget?.name}" and its teacher assignments.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

export function ClassesPage() {
  useEffect(() => {
    document.title = "Classes & Divisions | Smart Attendance";
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Classes &amp; Divisions</h2>
        <p className="text-sm text-muted-foreground">Manage classes, their divisions, and the subjects taught within them.</p>
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes &amp; Divisions</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="classes">
          <ClassesTab />
        </TabsContent>
        <TabsContent value="subjects">
          <SubjectsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
