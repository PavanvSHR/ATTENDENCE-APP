/**
 * Server-local mirror of the shared domain types defined in the frontend at
 * `src/types/index.ts`. This is a SEPARATE npm package from the frontend, so
 * we intentionally duplicate the subset of shapes we need rather than
 * importing across package boundaries. Keep these in sync by hand.
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
  faceEnrolled: boolean;
  biometricRegistered: boolean;
  registeredDeviceIds: string[];
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
  lockedAt?: string;
  lockedBy?: string;
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
  markedBy: string;
  markedByRole: UserRole;
  method: "self" | "manual";
  verification: AttendanceVerification;
  deviceId?: string;
  ipAddress?: string;
  timestamp: string;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  flaggedForReview: boolean;
  reason?: string;
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
  targetId: string;
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
  label: string;
  platform: "android" | "ios" | "web";
  status: "verified" | "pending" | "revoked";
  firstSeenAt: string;
  lastUsedAt: string;
}

export interface AttendancePolicy {
  minAttendancePercent: number;
  lateCountsAsPresent: boolean;
  geofenceRadiusMeters: number;
  collegeLocation: GeoPoint;
  requireFaceLiveness: boolean;
  faceMatchThreshold: number; // 0-1
  biometricEnabled: boolean;
  faceRecognitionEnabled: boolean;
  qrTokenTtlSeconds: number;
  maxRiskScoreAutoAccept: number;
}

/** Extends req with the authenticated caller, attached by authMiddleware. */
export interface AuthenticatedUser {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
