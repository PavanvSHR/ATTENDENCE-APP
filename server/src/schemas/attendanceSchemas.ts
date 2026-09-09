import { z } from "zod";

const attendanceStatusEnum = z.enum(["present", "absent", "late", "excused"]);

export const manualAttendanceSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1, "studentId is required"),
        status: attendanceStatusEnum,
        reason: z.string().min(1).optional(),
      })
    )
    .min(1, "At least one entry is required"),
});
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;

const locationInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  mockLocationSuspected: z.boolean().optional(),
});

const biometricAssertionSchema = z.object({
  success: z.boolean(),
  credentialId: z.string().optional(),
});

const faceVerificationSchema = z.object({
  livenessPassed: z.boolean(),
  matchConfidence: z.number().min(0).max(1),
});

export const selfAttendanceSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  qrToken: z.string().optional(),
  deviceId: z.string().min(1, "deviceId is required"),
  location: locationInputSchema.optional(),
  biometricAssertion: biometricAssertionSchema.optional(),
  faceVerification: faceVerificationSchema.optional(),
});
export type SelfAttendanceInput = z.infer<typeof selfAttendanceSchema>;

export const correctAttendanceSchema = z.object({
  newStatus: attendanceStatusEnum,
  reason: z.string().min(10, "reason must be at least 10 characters"),
});
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
