/**
 * "Start Attendance" form. Subject choice also fixes class/division (a
 * teacher never types those in — they're derived from which subject they
 * pick). Location defaults to the college-wide geofence unless the teacher
 * opts into a custom point + radius for this session.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getDoc, doc } from "firebase/firestore";
import { MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/useAuth";
import { policyCol } from "@/firebase/firestore";
import { useTeacherSubjects } from "@/features/classes/hooks/useClassOptions";
import { VerificationMethodSelector } from "@/features/attendance/components/VerificationMethodSelector";
import { createSessionSchema, type CreateSessionInput } from "@/schemas/attendance.schema";
import { createSession } from "@/features/attendance/services/sessionService";

interface DefaultLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

function envDefaultLocation(): DefaultLocation {
  return {
    latitude: Number(import.meta.env.VITE_DEFAULT_COLLEGE_LAT) || 0,
    longitude: Number(import.meta.env.VITE_DEFAULT_COLLEGE_LNG) || 0,
    radiusMeters: Number(import.meta.env.VITE_DEFAULT_GEOFENCE_RADIUS_M) || 100,
  };
}

export function CreateSessionPage() {
  const { profile } = useAuth();
  const teacherId = profile?.userId;
  const navigate = useNavigate();
  const { toast } = useToast();

  const { subjects, loading: subjectsLoading } = useTeacherSubjects(teacherId);
  const [defaultLocation, setDefaultLocation] = useState<DefaultLocation>(envDefaultLocation());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Start Attendance | Smart Attendance";
  }, []);

  // Prefer the college-wide policy document; fall back to build-time env defaults.
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(policyCol, "attendancePolicy"))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const policy = snap.data();
        if (policy.collegeLocation) {
          setDefaultLocation({
            latitude: policy.collegeLocation.latitude,
            longitude: policy.collegeLocation.longitude,
            radiusMeters: policy.geofenceRadiusMeters ?? envDefaultLocation().radiusMeters,
          });
        }
      })
      .catch(() => {
        /* keep env fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      subjectId: "",
      classId: "",
      divisionId: "",
      date: new Date().toISOString().slice(0, 10),
      startTime: "",
      endTime: "",
      verificationMethods: [],
      useCollegeDefaultLocation: true,
    },
  });

  const subjectId = watch("subjectId");
  const verificationMethods = watch("verificationMethods");
  const useCollegeDefaultLocation = watch("useCollegeDefaultLocation");
  const locationRequired = verificationMethods.includes("location");

  function handleSubjectChange(id: string) {
    const subject = subjects.find((s) => s.subjectId === id);
    setValue("subjectId", id, { shouldValidate: true });
    if (subject) {
      setValue("classId", subject.classId, { shouldValidate: true });
      setValue("divisionId", subject.divisionId, { shouldValidate: true });
    }
  }

  async function onSubmit(values: CreateSessionInput) {
    if (!teacherId || !profile) {
      toast({ title: "You're not signed in", description: "Please sign in again and retry.", variant: "destructive" });
      return;
    }
    const subject = subjects.find((s) => s.subjectId === values.subjectId);
    if (!subject) {
      toast({ title: "Select a subject", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const res = await createSession({
      ...values,
      teacherId,
      teacherName: profile.name,
      subjectName: subject.subjectName,
    });
    setSubmitting(false);

    if (!res.success) {
      toast({ title: "Couldn't start attendance", description: res.error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Attendance session started" });
    navigate(`/teacher/sessions/${res.data.sessionId}`);
  }

  if (subjectsLoading) return <LoadingSpinner label="Loading your subjects..." />;

  if (subjects.length === 0) {
    return (
      <EmptyState
        title="No subjects assigned"
        description="You're not assigned to teach any subject yet. Contact your administrator."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Start Attendance</h2>
        <p className="text-sm text-muted-foreground">Set up a new attendance session for your class.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Class details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subjectId">Subject</Label>
              <Select value={subjectId} onValueChange={handleSubjectChange}>
                <SelectTrigger id="subjectId">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.subjectId} value={s.subjectId}>
                      {s.subjectName} &middot; {s.className} {s.divisionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subjectId && <p className="text-sm text-destructive">{errors.subjectId.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" type="time" {...register("startTime")} />
                {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" type="time" {...register("endTime")} />
                {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification methods</CardTitle>
            <CardDescription>Choose how students will be allowed to check in for this session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              name="verificationMethods"
              control={control}
              render={({ field }) => (
                <VerificationMethodSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.verificationMethods?.message}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
            <CardDescription>
              {locationRequired
                ? "Required because Location verification is selected."
                : "Only used if Location verification is selected."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Use college default location</p>
                  <p className="text-xs text-muted-foreground">
                    {defaultLocation.latitude.toFixed(5)}, {defaultLocation.longitude.toFixed(5)} &middot; {defaultLocation.radiusMeters}m
                    radius
                  </p>
                </div>
              </div>
              <Controller
                name="useCollegeDefaultLocation"
                control={control}
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>

            {!useCollegeDefaultLocation && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input id="latitude" type="number" step="any" placeholder={String(defaultLocation.latitude)} {...register("latitude")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input id="longitude" type="number" step="any" placeholder={String(defaultLocation.longitude)} {...register("longitude")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radiusMeters">Radius (meters)</Label>
                  <Input
                    id="radiusMeters"
                    type="number"
                    step="1"
                    placeholder={String(defaultLocation.radiusMeters)}
                    {...register("radiusMeters")}
                  />
                </div>
                {errors.latitude && <p className="text-sm text-destructive sm:col-span-3">{errors.latitude.message}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" size="lg" disabled={submitting}>
            <MapPin className="h-4 w-4" />
            {submitting ? "Starting..." : "Start Attendance"}
          </Button>
        </div>
      </form>
    </div>
  );
}
