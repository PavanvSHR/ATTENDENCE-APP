/**
 * Minimal type subset mirroring src/types/index.ts, duplicated here because
 * functions/ is a separate npm package (same convention server/src/types
 * already uses relative to the frontend). Keep in sync manually if the
 * shared shapes in src/types/index.ts change; src/types/index.ts remains
 * the single source of truth for the overall schema.
 */

export type UserRole = "admin" | "teacher" | "cr" | "student";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type RiskLevel = "low" | "suspicious" | "high";

export type SessionStatus = "draft" | "open" | "finalized" | "locked" | "expired";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface AttendanceVerification {
  biometric?: "success" | "failed" | "not_required" | "skipped";
  face?: "success" | "failed" | "not_required" | "skipped";
  faceConfidence?: number;
  location?: "success" | "failed" | "not_required" | "skipped";
  distanceMeters?: number;
  qr?: "success" | "failed" | "not_required" | "skipped";
}

export interface AttendanceRecord {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: AttendanceStatus;
  markedBy: string;
  markedByRole: UserRole;
  method: "self" | "manual";
  verification: AttendanceVerification;
  deviceId?: string;
  ipAddress?: string;
  timestamp: string;
  riskScore: number;
  riskLevel: RiskLevel;
  flaggedForReview: boolean;
  reason?: string;
  correctedAt?: string;
  correctedBy?: string;
}

export interface AttendanceSession {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  divisionId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  createdBy: string;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  totalStudents: number;
}

export interface StudentRecord {
  studentId: string;
  userId: string;
  rollNumber: string;
  enrollmentNumber: string;
  name: string;
  collegeEmail: string;
  classId: string;
  divisionId: string;
  academicYear: string;
  semester: number;
  status: "active" | "disabled" | "pending";
}

export interface TeacherRecord {
  teacherId: string;
  userId: string;
  departmentId: string;
  name: string;
  subjectIds: string[];
}

export type NotificationType =
  | "attendance_marked"
  | "attendance_rejected"
  | "low_attendance"
  | "session_started"
  | "session_closed"
  | "attendance_correction"
  | "suspicious_attempt";

export interface AppNotification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  relatedId?: string;
}

export interface AttendancePolicy {
  minAttendancePercent: number;
  lateCountsAsPresent: boolean;
  geofenceRadiusMeters: number;
  collegeLocation: GeoPoint;
  requireFaceLiveness: boolean;
  faceMatchThreshold: number;
  biometricEnabled: boolean;
  faceRecognitionEnabled: boolean;
  qrTokenTtlSeconds: number;
  maxRiskScoreAutoAccept: number;
}
