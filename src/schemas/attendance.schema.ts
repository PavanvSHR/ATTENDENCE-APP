import { z } from "zod";

export const createSessionSchema = z
  .object({
    subjectId: z.string().min(1, "Select a subject"),
    classId: z.string().min(1, "Select a class"),
    divisionId: z.string().min(1, "Select a division"),
    date: z.string().min(1, "Select a date"),
    startTime: z.string().min(1, "Select a start time"),
    endTime: z.string().min(1, "Select an end time"),
    verificationMethods: z
      .array(z.enum(["biometric", "face", "location", "manual", "qr"]))
      .min(1, "Select at least one verification method"),
    useCollegeDefaultLocation: z.boolean().default(true),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().min(5).max(2000).optional(),
  })
  .refine((data) => new Date(`${data.date}T${data.endTime}`) > new Date(`${data.date}T${data.startTime}`), {
    message: "End time must be after start time",
    path: ["endTime"],
  })
  .refine(
    (data) =>
      !data.verificationMethods.includes("location") ||
      data.useCollegeDefaultLocation ||
      (data.latitude !== undefined && data.longitude !== undefined && data.radiusMeters !== undefined),
    {
      message: "Set a location and radius, or use the college default",
      path: ["latitude"],
    }
  );
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const manualAttendanceEntrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
  reason: z.string().optional(),
});

export const manualAttendanceBatchSchema = z.object({
  sessionId: z.string().min(1),
  entries: z.array(manualAttendanceEntrySchema).min(1),
});
export type ManualAttendanceBatchInput = z.infer<typeof manualAttendanceBatchSchema>;

export const correctionSchema = z.object({
  recordId: z.string().min(1),
  newStatus: z.enum(["present", "absent", "late", "excused"]),
  reason: z.string().min(10, "Provide a detailed reason (min 10 characters)"),
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

/** Payload the client submits for self-attendance; the server independently
 *  re-derives distance/risk and never trusts client-computed verdicts. */
export const selfAttendanceAttemptSchema = z.object({
  sessionId: z.string().min(1),
  qrToken: z.string().optional(),
  deviceId: z.string().min(1, "Device is not registered"),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().nonnegative().optional(),
      mockLocationSuspected: z.boolean().optional(),
    })
    .optional(),
  biometricAssertion: z
    .object({
      success: z.boolean(),
      credentialId: z.string().optional(),
    })
    .optional(),
  faceVerification: z
    .object({
      livenessPassed: z.boolean(),
      matchConfidence: z.number().min(0).max(1),
    })
    .optional(),
});
export type SelfAttendanceAttemptInput = z.infer<typeof selfAttendanceAttemptSchema>;
