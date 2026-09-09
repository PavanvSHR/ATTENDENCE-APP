import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name is required"),
  code: z.string().min(2, "Department code is required").max(10),
  collegeName: z.string().min(2, "College name is required"),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const classSchema = z.object({
  name: z.string().min(2, "Class name is required"),
  departmentId: z.string().min(1, "Select a department"),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Format must be YYYY-YYYY"),
  semester: z.coerce.number().int().min(1).max(12),
  divisions: z.array(z.string().min(1)).min(1, "Add at least one division"),
});
export type ClassInput = z.infer<typeof classSchema>;

export const subjectSchema = z.object({
  name: z.string().min(2, "Subject name is required"),
  code: z.string().min(2, "Subject code is required"),
  classId: z.string().min(1, "Select a class"),
  divisionId: z.string().min(1, "Select a division"),
  teacherIds: z.array(z.string()).default([]),
});
export type SubjectInput = z.infer<typeof subjectSchema>;

export const studentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  collegeEmail: z.string().email("Enter a valid college email"),
  phone: z.string().optional(),
  rollNumber: z.string().min(1, "Roll number is required"),
  enrollmentNumber: z.string().min(1, "Enrollment number is required"),
  classId: z.string().min(1, "Select a class"),
  divisionId: z.string().min(1, "Select a division"),
  academicYear: z.string().min(4),
  semester: z.coerce.number().int().min(1).max(12),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const teacherSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  departmentId: z.string().min(1, "Select a department"),
  subjectIds: z.array(z.string()).default([]),
});
export type TeacherInput = z.infer<typeof teacherSchema>;

export const classRepresentativeSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  divisionId: z.string().min(1),
  authorizedByUserId: z.string().min(1),
});
export type ClassRepresentativeInput = z.infer<typeof classRepresentativeSchema>;

export const attendancePolicySchema = z.object({
  minAttendancePercent: z.coerce.number().min(0).max(100),
  lateCountsAsPresent: z.boolean(),
  geofenceRadiusMeters: z.coerce.number().min(5).max(2000),
  collegeLocation: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
  requireFaceLiveness: z.boolean(),
  faceMatchThreshold: z.coerce.number().min(0.5).max(0.99),
  biometricEnabled: z.boolean(),
  faceRecognitionEnabled: z.boolean(),
  qrTokenTtlSeconds: z.coerce.number().int().min(15).max(600),
  maxRiskScoreAutoAccept: z.coerce.number().int().min(0).max(100),
});
export type AttendancePolicyInput = z.infer<typeof attendancePolicySchema>;
