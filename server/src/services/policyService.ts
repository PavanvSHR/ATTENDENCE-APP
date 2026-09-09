import { db } from "../config/firebaseAdmin";
import { AttendancePolicy } from "../types";

/**
 * Fallback policy used when settings/attendancePolicy hasn't been created
 * yet in Firestore, so the API keeps working (with sane defaults) out of
 * the box rather than 500ing on a missing settings doc.
 */
const DEFAULT_POLICY: AttendancePolicy = {
  minAttendancePercent: 75,
  lateCountsAsPresent: false,
  geofenceRadiusMeters: 100,
  collegeLocation: { latitude: 0, longitude: 0 },
  requireFaceLiveness: true,
  faceMatchThreshold: 0.8,
  biometricEnabled: true,
  faceRecognitionEnabled: true,
  qrTokenTtlSeconds: 60,
  maxRiskScoreAutoAccept: 50,
};

export async function getAttendancePolicy(): Promise<AttendancePolicy> {
  const snap = await db.collection("settings").doc("attendancePolicy").get();
  if (!snap.exists) {
    return DEFAULT_POLICY;
  }
  const data = snap.data() as Partial<AttendancePolicy>;
  return { ...DEFAULT_POLICY, ...data };
}
