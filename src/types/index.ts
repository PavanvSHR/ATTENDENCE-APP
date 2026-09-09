/**
 * Shared domain types — mirrors the Firestore schema (see docs/ARCHITECTURE.md)
 * and the request/response contracts of the server/ API. Keep this file the
 * single source of truth; server/src/types/index.ts intentionally duplicates
 * the subset it needs (frontend and backend are separate npm packages).
 */

export type UserRole = "admin" | "teacher" | "cr" | "student";

export type AccountStatus = "active" | "disabled" | "pending";

export interface UserRecord {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  phone?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Department {
  departmentId: string;
  name: string;
  code: string;
  collegeName: string;
}

export interface ClassRecord {
  classId: string;
  name: string; // e.g. "B.Tech CSE 2nd Year"
  departmentId: string;
  academicYear: string; // "2026-2027"
  semester: number;
  divisions: string[]; // ["A", "B"]
}

export interface Division {
  divisionId: string;
  classId: string;
  name: string;
  classRepresentativeIds: string[];
}

export interface Subject {
  subjectId: string;
  name: string;
  code: string;
  classId: string;
  divisionId: string;
  teacherIds: string[];
}

export interface StudentRecord {
  studentId: string;
  userId: string;
  rollNumber: string;
  enrollmentNumber: string;
  name: string;
  collegeEmail: string;
  phone?: string;
  classId: string;
  divisionId: string;
  academicYear: string;
  semester: number;
  profilePhotoUrl?: string;
  status: AccountStatus;
  faceEnrolled: boolean; // true if a face descriptor is on file (never the raw image)
  biometricRegistered: boolean;
  registeredDeviceIds: string[];
}

export interface TeacherRecord {
  teacherId: string;
  userId: string;
  departmentId: string;
  name: string;
  subjectIds: string[];
}

export type VerificationMethod = "biometric" | "face" | "location" | "manual" | "qr";

export type SessionStatus = "draft" | "open" | "finalized" | "locked" | "expired";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface AttendanceSession {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  divisionId: string;
  date: string; // ISO date
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  verificationMethods: VerificationMethod[];
  location?: GeoPoint;
  radiusMeters?: number;
  status: SessionStatus;
  qrToken?: string;
  qrExpiresAt?: string;
  createdBy: string;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  totalStudents: number;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type VerificationResult = "success" | "failed" | "not_required" | "skipped";

export interface AttendanceVerification {
  biometric?: VerificationResult;
  face?: VerificationResult;
  faceConfidence?: number; // 0-1, never exposed to teacher/student UI beyond pass/fail
  location?: VerificationResult;
  distanceMeters?: number;
  qr?: VerificationResult;
}

export type RiskLevel = "low" | "suspicious" | "high";

export interface AttendanceRecord {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: AttendanceStatus;
  markedBy: string; // userId of student (self), teacher, or CR
  markedByRole: UserRole;
  method: "self" | "manual";
  verification: AttendanceVerification;
  deviceId?: string;
  ipAddress?: string;
  timestamp: string;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  flaggedForReview: boolean;
  reason?: string; // required when correcting after finalization
  correctedAt?: string;
  correctedBy?: string;
}

export type AuditAction =
  | "TEACHER_MARKED_PRESENT"
  | "TEACHER_CHANGED_ATTENDANCE"
  | "CR_MARKED_PRESENT"
  | "STUDENT_SELF_MARKED"
  | "ADMIN_MODIFIED_ATTENDANCE"
  | "BIOMETRIC_FAILED"
  | "FACE_FAILED"
  | "LOCATION_FAILED"
  | "DUPLICATE_ATTEMPT"
  | "SESSION_CREATED"
  | "SESSION_STARTED"
  | "SESSION_FINALIZED"
  | "SESSION_LOCKED"
  | "DEVICE_REGISTERED"
  | "DEVICE_REJECTED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED";

export interface AuditLogEntry {
  logId: string;
  userId: string;
  userRole: UserRole;
  action: AuditAction;
  timestamp: string;
  targetId: string; // sessionId, recordId, or userId affected
  targetType: "session" | "attendanceRecord" | "user" | "device";
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  verificationMethod?: VerificationMethod;
  ipAddress?: string;
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

export interface RegisteredDevice {
  deviceId: string;
  userId: string;
  label: string; // e.g. "Android Phone"
  platform: "android" | "ios" | "web";
  status: "verified" | "pending" | "revoked";
  firstSeenAt: string;
  lastUsedAt: string;
}

export interface AttendancePolicy {
  minAttendancePercent: number; // e.g. 75
  lateCountsAsPresent: boolean;
  geofenceRadiusMeters: number;
  collegeLocation: GeoPoint;
  requireFaceLiveness: boolean;
  faceMatchThreshold: number; // 0-1
  biometricEnabled: boolean;
  faceRecognitionEnabled: boolean;
  qrTokenTtlSeconds: number;
  maxRiskScoreAutoAccept: number; // above this, auto-flag for review
}

export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectName: string;
  present: number;
  total: number;
  percentage: number;
}
