import { z } from "zod";

const verificationMethodEnum = z.enum(["biometric", "face", "location", "manual", "qr"]);

export const createSessionSchema = z
  .object({
    subjectId: z.string().min(1, "subjectId is required"),
    classId: z.string().min(1, "classId is required"),
    divisionId: z.string().min(1, "divisionId is required"),
    date: z.string().min(1, "date is required"),
    startTime: z.string().min(1, "startTime is required"),
    endTime: z.string().min(1, "endTime is required"),
    verificationMethods: z.array(verificationMethodEnum).min(1, "At least one verification method is required"),
    useCollegeDefaultLocation: z.boolean(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radiusMeters: z.number().positive().optional(),
    teacherId: z.string().min(1, "teacherId is required"),
    teacherName: z.string().min(1, "teacherName is required"),
    subjectName: z.string().min(1, "subjectName is required"),
  })
  .superRefine((val, ctx) => {
    const start = Date.parse(val.startTime);
    const end = Date.parse(val.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startTime/endTime must be valid ISO datetime strings",
        path: ["startTime"],
      });
    } else if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be after startTime",
        path: ["endTime"],
      });
    }

    if (val.verificationMethods.includes("location") && !val.useCollegeDefaultLocation) {
      if (val.latitude === undefined || val.longitude === undefined || val.radiusMeters === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "latitude, longitude, and radiusMeters are required when using 'location' verification without the college default location",
          path: ["latitude"],
        });
      }
    }
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
