import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";
import { useAttendancePolicy } from "../hooks/useAdminCollections";
import { saveAttendancePolicy } from "../services/adminDataService";
import { attendancePolicySchema, type AttendancePolicyInput } from "@/schemas/class.schema";

const DEFAULT_POLICY: AttendancePolicyInput = {
  minAttendancePercent: 75,
  lateCountsAsPresent: true,
  geofenceRadiusMeters: 100,
  collegeLocation: { latitude: 0, longitude: 0 },
  requireFaceLiveness: true,
  faceMatchThreshold: 0.85,
  biometricEnabled: true,
  faceRecognitionEnabled: true,
  qrTokenTtlSeconds: 30,
  maxRiskScoreAutoAccept: 70,
};

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsPolicyPage() {
  const { policy, loading } = useAttendancePolicy();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Settings & Policy | Smart Attendance";
  }, []);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AttendancePolicyInput>({
    resolver: zodResolver(attendancePolicySchema),
    defaultValues: DEFAULT_POLICY,
  });

  useEffect(() => {
    if (policy) reset(policy);
  }, [policy, reset]);

  async function onSubmit(values: AttendancePolicyInput) {
    try {
      await saveAttendancePolicy(values);
      toast({ title: "Policy saved", description: "Attendance policy updated for all sessions." });
      reset(values);
    } catch (err) {
      toast({
        title: "Couldn't save policy",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const latitude = watch("collegeLocation.latitude");
  const longitude = watch("collegeLocation.longitude");
  const mapsHref = `https://maps.google.com/?q=${latitude ?? 0},${longitude ?? 0}`;

  if (loading) return <LoadingSpinner label="Loading attendance policy..." />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Settings &amp; Attendance Policy</h2>
        <p className="text-sm text-muted-foreground">
          Controls applied college-wide to every attendance session — minimums, geofencing, and verification methods.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> General
            </CardTitle>
            <CardDescription>Minimum attendance requirement and risk-flagging threshold.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minAttendancePercent">Minimum attendance %</Label>
              <Input id="minAttendancePercent" type="number" min={0} max={100} {...register("minAttendancePercent")} />
              {errors.minAttendancePercent && (
                <p className="text-sm text-destructive">{errors.minAttendancePercent.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRiskScoreAutoAccept">Max risk score to auto-accept</Label>
              <Input id="maxRiskScoreAutoAccept" type="number" min={0} max={100} {...register("maxRiskScoreAutoAccept")} />
              <p className="text-xs text-muted-foreground">Records scoring above this are auto-flagged for review.</p>
              {errors.maxRiskScoreAutoAccept && (
                <p className="text-sm text-destructive">{errors.maxRiskScoreAutoAccept.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="lateCountsAsPresent"
                render={({ field }) => (
                  <SwitchRow
                    label="Late counts as present"
                    description="Students marked 'late' contribute to their present count."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Geofencing &amp; College Location
            </CardTitle>
            <CardDescription>Students must be within this radius of the college to self-mark attendance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" step="any" {...register("collegeLocation.latitude")} />
              {errors.collegeLocation?.latitude && (
                <p className="text-sm text-destructive">{errors.collegeLocation.latitude.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" step="any" {...register("collegeLocation.longitude")} />
              {errors.collegeLocation?.longitude && (
                <p className="text-sm text-destructive">{errors.collegeLocation.longitude.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="geofenceRadiusMeters">Radius (meters)</Label>
              <Input id="geofenceRadiusMeters" type="number" min={5} max={2000} {...register("geofenceRadiusMeters")} />
              {errors.geofenceRadiusMeters && (
                <p className="text-sm text-destructive">{errors.geofenceRadiusMeters.message}</p>
              )}
            </div>
            <div className="sm:col-span-3">
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" /> Preview this location on Google Maps
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: open Google Maps, right-click your college's location, and copy the coordinates shown into the
                fields above.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verification Methods</CardTitle>
            <CardDescription>Which identity checks are required or available when marking attendance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Controller
              control={control}
              name="biometricEnabled"
              render={({ field }) => (
                <SwitchRow
                  label="Biometric verification enabled"
                  description="Allow device biometric (fingerprint/face unlock) as a verification method."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="faceRecognitionEnabled"
              render={({ field }) => (
                <SwitchRow
                  label="Face recognition enabled"
                  description="Allow face-descriptor matching as a verification method."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="requireFaceLiveness"
              render={({ field }) => (
                <SwitchRow
                  label="Require face liveness check"
                  description="Reject static photos; require a live liveness signal during face verification."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="faceMatchThreshold">Face match threshold (0.5 – 0.99)</Label>
                <Input
                  id="faceMatchThreshold"
                  type="number"
                  step="0.01"
                  min={0.5}
                  max={0.99}
                  {...register("faceMatchThreshold")}
                />
                {errors.faceMatchThreshold && (
                  <p className="text-sm text-destructive">{errors.faceMatchThreshold.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="qrTokenTtlSeconds">QR token TTL (seconds)</Label>
                <Input id="qrTokenTtlSeconds" type="number" min={15} max={600} {...register("qrTokenTtlSeconds")} />
                {errors.qrTokenTtlSeconds && (
                  <p className="text-sm text-destructive">{errors.qrTokenTtlSeconds.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Policy"}
          </Button>
        </div>
      </form>
    </div>
  );
}
