import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebaseAdmin";
import { requireRole } from "../middleware/roleMiddleware";
import { validateBody } from "../middleware/validate";
import { selfAttendanceLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/response";
import { manualAttendanceSchema, selfAttendanceSchema, correctAttendanceSchema, ManualAttendanceInput, SelfAttendanceInput, CorrectAttendanceInput } from "../schemas/attendanceSchemas";
import { writeAuditLog } from "../services/auditService";
import { haversineDistanceMeters } from "../services/geoService";
import { computeRiskScore } from "../services/riskService";
import { getAttendancePolicy } from "../services/policyService";
import { AttendanceRecord, AttendanceSession, AttendanceStatus, AttendanceVerification, AuditAction, StudentRecord } from "../types";

const router = Router();

// ---- Policy-adjacent constants not present on AttendancePolicy today ----
// (kept local + documented rather than silently inventing new fields on the
// shared AttendancePolicy shape, which other agents also depend on).
const LATE_GRACE_MINUTES = 5;
const SESSION_CLOSE_GRACE_MINUTES = 10;
const LOW_ACCURACY_THRESHOLD_METERS = 50;
const RAPID_MULTI_STUDENT_WINDOW_SECONDS = 30;

/**
 * POST /api/attendance/manual
 * Teacher/CR/admin bulk-mark attendance for a roster. Deterministic doc id
 * `${sessionId}_${studentId}` is both the write target AND the
 * duplicate-prevention mechanism (a second identical write is idempotent;
 * a status CHANGE requires a reason and is logged as a correction).
 */
router.post(
  "/manual",
  requireRole("teacher", "cr", "admin"),
  validateBody(manualAttendanceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ManualAttendanceInput;

    const sessionSnap = await db.collection("attendanceSessions").doc(body.sessionId).get();
    if (!sessionSnap.exists) {
      throw new AppError(404, "session_not_found", "Attendance session not found.");
    }
    const session = sessionSnap.data() as AttendanceSession;
    if (session.status === "locked") {
      throw new AppError(409, "session_locked", "This session is locked; attendance can no longer be changed.");
    }

    const now = new Date().toISOString();
    const markedByRole = req.user!.role;
    const primaryAction: AuditAction = markedByRole === "cr" ? "CR_MARKED_PRESENT" : "TEACHER_MARKED_PRESENT";

    const refs = body.entries.map((entry) => ({
      entry,
      recordRef: db.collection("attendanceRecords").doc(`${body.sessionId}_${entry.studentId}`),
      studentRef: db.collection("students").doc(entry.studentId),
    }));

    const writtenRecords = await db.runTransaction(async (tx) => {
      // ---- READ PHASE: all reads must happen before any writes in a Firestore transaction ----
      const recordSnaps = await Promise.all(refs.map((r) => tx.get(r.recordRef)));
      const studentSnaps = await Promise.all(refs.map((r) => tx.get(r.studentRef)));

      const plannedWrites: Array<{
        recordRef: FirebaseFirestore.DocumentReference;
        data: AttendanceRecord;
        auditAction: AuditAction;
        previousValue?: unknown;
        newValue?: unknown;
        reason?: string;
      }> = [];

      for (let i = 0; i < refs.length; i++) {
        const { entry, recordRef } = refs[i];
        const existingSnap = recordSnaps[i];
        const studentSnap = studentSnaps[i];
        const studentData = studentSnap.exists ? (studentSnap.data() as StudentRecord) : undefined;

        if (existingSnap.exists) {
          const existing = existingSnap.data() as AttendanceRecord;
          if (existing.status !== entry.status) {
            if (!entry.reason) {
              throw new AppError(
                400,
                "reason_required",
                `A reason is required to change ${entry.studentId}'s attendance from '${existing.status}' to '${entry.status}'.`,
                { entries: [`reason is required for studentId ${entry.studentId} because the status is changing`] }
              );
            }
            const updated: AttendanceRecord = {
              ...existing,
              status: entry.status,
              reason: entry.reason,
              correctedAt: now,
              correctedBy: req.user!.uid,
            };
            plannedWrites.push({
              recordRef,
              data: updated,
              auditAction: markedByRole === "cr" ? "CR_MARKED_PRESENT" : "TEACHER_CHANGED_ATTENDANCE",
              previousValue: { status: existing.status },
              newValue: { status: entry.status },
              reason: entry.reason,
            });
          }
          // else: status unchanged — no-op, nothing to write or log.
        } else {
          const newRecord: AttendanceRecord = {
            recordId: recordRef.id,
            sessionId: body.sessionId,
            studentId: entry.studentId,
            studentName: studentData?.name ?? "",
            rollNumber: studentData?.rollNumber ?? "",
            status: entry.status,
            markedBy: req.user!.uid,
            markedByRole,
            method: "manual",
            verification: {
              biometric: "not_required",
              face: "not_required",
              location: "not_required",
              qr: "not_required",
            },
            timestamp: now,
            riskScore: 0,
            riskLevel: "low",
            flaggedForReview: false,
            ...(entry.reason ? { reason: entry.reason } : {}),
          };
          plannedWrites.push({
            recordRef,
            data: newRecord,
            auditAction: primaryAction,
            newValue: { status: entry.status },
          });
        }
      }

      // ---- WRITE PHASE ----
      for (const w of plannedWrites) {
        tx.set(w.recordRef, w.data, { merge: true });
        const auditRef = db.collection("auditLogs").doc();
        tx.set(auditRef, {
          logId: auditRef.id,
          userId: req.user!.uid,
          userRole: req.user!.role,
          action: w.auditAction,
          timestamp: now,
          targetId: w.data.recordId,
          targetType: "attendanceRecord",
          previousValue: w.previousValue,
          newValue: w.newValue,
          reason: w.reason,
          ipAddress: req.ip,
        });
      }

      return plannedWrites.map((w) => w.data);
    });

    sendSuccess(res, writtenRecords, 200);
  })
);

/**
 * POST /api/attendance/self
 * Full server-side verification pipeline — the frontend NEVER decides pass/
 * fail here, it only collects raw signals (location, biometric assertion,
 * face liveness/confidence, deviceId, qrToken) and this endpoint is the sole
 * authority on the verdict. Steps run in order and short-circuit on the
 * first hard failure, per the contract.
 */
router.post(
  "/self",
  requireRole("student"),
  selfAttendanceLimiter,
  validateBody(selfAttendanceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as SelfAttendanceInput;
    const uid = req.user!.uid;
    const now = new Date();
    const nowIso = now.toISOString();
    const ipAddress = req.ip;

    // 1. Load session.
    const sessionSnap = await db.collection("attendanceSessions").doc(body.sessionId).get();
    if (!sessionSnap.exists) {
      throw new AppError(404, "session_not_found", "Attendance session not found.");
    }
    const session = sessionSnap.data() as AttendanceSession;
    const policy = await getAttendancePolicy();

    const startMs = Date.parse(session.startTime);
    const endMs = Date.parse(session.endTime);
    const closeCutoffMs = endMs + SESSION_CLOSE_GRACE_MINUTES * 60 * 1000;

    if (session.status !== "open" || now.getTime() < startMs || now.getTime() > closeCutoffMs) {
      throw new AppError(409, "session_closed", "This attendance session is not currently open.");
    }

    // 2. Duplicate check (fast pre-check for a clear error message; the
    // AUTHORITATIVE duplicate guard is the transaction re-check at the end).
    const recordRef = db.collection("attendanceRecords").doc(`${body.sessionId}_${uid}`);
    const preCheckSnap = await recordRef.get();
    if (preCheckSnap.exists) {
      await writeAuditLog({
        userId: uid,
        userRole: "student",
        action: "DUPLICATE_ATTEMPT",
        timestamp: nowIso,
        targetId: body.sessionId,
        targetType: "session",
        ipAddress,
      });
      throw new AppError(409, "duplicate", "Attendance has already been recorded for this session.");
    }

    const verification: AttendanceVerification = {};

    // 3. QR
    if (session.verificationMethods.includes("qr")) {
      const qrValid =
        !!body.qrToken &&
        body.qrToken === session.qrToken &&
        !!session.qrExpiresAt &&
        now.getTime() < Date.parse(session.qrExpiresAt);
      if (!qrValid) {
        throw new AppError(403, "qr_expired", "QR code has expired. Ask your teacher to refresh it.");
      }
      verification.qr = "success";
    } else {
      verification.qr = "not_required";
    }

    // 4. Location
    let mockLocationSuspected = false;
    let lowGpsAccuracy = false;
    if (session.verificationMethods.includes("location")) {
      if (!body.location) {
        throw new AppError(400, "location_required", "Location access is required to mark attendance for this session.");
      }
      mockLocationSuspected = body.location.mockLocationSuspected === true;
      if (body.location.accuracy !== undefined && body.location.accuracy > LOW_ACCURACY_THRESHOLD_METERS) {
        lowGpsAccuracy = true; // risk factor only, never a hard rejection on its own
      }
      if (!session.location || !session.radiusMeters) {
        throw new AppError(500, "session_misconfigured", "This session is missing location configuration. Contact your teacher.");
      }
      const distanceMeters = haversineDistanceMeters(session.location, {
        latitude: body.location.latitude,
        longitude: body.location.longitude,
      });
      if (distanceMeters > session.radiusMeters) {
        await writeAuditLog({
          userId: uid,
          userRole: "student",
          action: "LOCATION_FAILED",
          timestamp: nowIso,
          targetId: body.sessionId,
          targetType: "session",
          verificationMethod: "location",
          ipAddress,
          newValue: { distanceMeters, radiusMeters: session.radiusMeters },
        });
        throw new AppError(403, "outside_geofence", "Attendance cannot be marked because you are outside the allowed attendance location.");
      }
      verification.location = "success";
      verification.distanceMeters = distanceMeters;
    } else {
      verification.location = "not_required";
    }

    // 5. Biometric
    if (session.verificationMethods.includes("biometric")) {
      if (body.biometricAssertion?.success !== true) {
        await writeAuditLog({
          userId: uid,
          userRole: "student",
          action: "BIOMETRIC_FAILED",
          timestamp: nowIso,
          targetId: body.sessionId,
          targetType: "session",
          verificationMethod: "biometric",
          ipAddress,
        });
        throw new AppError(403, "biometric_failed", "Biometric verification failed. Please try again.");
      }
      verification.biometric = "success";
    } else {
      verification.biometric = "not_required";
    }

    // 6. Face
    if (session.verificationMethods.includes("face")) {
      const threshold = policy.faceMatchThreshold ?? 0.8;
      const passed =
        body.faceVerification?.livenessPassed === true && (body.faceVerification?.matchConfidence ?? 0) >= threshold;
      if (!passed) {
        await writeAuditLog({
          userId: uid,
          userRole: "student",
          action: "FACE_FAILED",
          timestamp: nowIso,
          targetId: body.sessionId,
          targetType: "session",
          verificationMethod: "face",
          ipAddress,
        });
        throw new AppError(403, "face_failed", "Face verification failed. Please ensure good lighting and look directly at the camera.");
      }
      verification.face = "success";
      verification.faceConfidence = body.faceVerification!.matchConfidence;
    } else {
      verification.face = "not_required";
    }

    // 7. Device check. This is a deliberate JUDGMENT CALL per the spec: an
    // unrecognized device must NOT silently hard-block attendance — it must
    // "require additional verification or teacher approval". We interpret
    // that here as: accept + flag for review + heavy risk penalty, and log a
    // DEVICE_REJECTED audit note (informational, not a rejection of the
    // request itself).
    const studentRef = db.collection("students").doc(uid);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      throw new AppError(404, "student_not_found", "Your student profile could not be found. Contact your administrator.");
    }
    const student = studentSnap.data() as StudentRecord;
    const registeredDeviceIds = student.registeredDeviceIds ?? [];
    let newOrUnrecognizedDevice = false;

    if (!registeredDeviceIds.includes(body.deviceId)) {
      if (registeredDeviceIds.length === 0) {
        // First-device bootstrap: student has no devices on file yet, so
        // trust and register this one automatically.
        await db.collection("devices").doc(body.deviceId).set({
          deviceId: body.deviceId,
          userId: uid,
          label: "Auto-registered device",
          platform: "web",
          status: "verified",
          firstSeenAt: nowIso,
          lastUsedAt: nowIso,
        });
        await studentRef.update({ registeredDeviceIds: FieldValue.arrayUnion(body.deviceId) });
      } else {
        newOrUnrecognizedDevice = true;
        await writeAuditLog({
          userId: uid,
          userRole: "student",
          action: "DEVICE_REJECTED",
          timestamp: nowIso,
          targetId: body.sessionId,
          targetType: "session",
          ipAddress,
          newValue: {
            deviceId: body.deviceId,
            note: "Unrecognized device used for self-attendance; accepted but flagged for review, not hard-blocked (per spec).",
          },
        });
      }
    }

    // 8. Rapid multi-student same-source heuristic (best-effort). Wrapped in
    // try/catch: this is a soft signal, and a missing Firestore composite
    // index (sessionId + deviceId + timestamp) must never break marking.
    let rapidMultiStudentSameSource = false;
    try {
      const windowStartIso = new Date(now.getTime() - RAPID_MULTI_STUDENT_WINDOW_SECONDS * 1000).toISOString();
      const recentSnap = await db
        .collection("attendanceRecords")
        .where("sessionId", "==", body.sessionId)
        .where("deviceId", "==", body.deviceId)
        .where("timestamp", ">=", windowStartIso)
        .limit(5)
        .get();
      rapidMultiStudentSameSource = recentSnap.docs.some((d) => (d.data() as AttendanceRecord).studentId !== uid);
    } catch (err) {
      console.warn("rapidMultiStudentSameSource heuristic query failed (check Firestore indexes):", err);
    }

    // 9. Risk scoring (never used to auto-reject — only to flag).
    const { score: riskScore, level: riskLevel } = computeRiskScore({
      mockLocationSuspected,
      lowGpsAccuracy,
      newOrUnrecognizedDevice,
      softFailedVerificationCount: 0,
      rapidMultiStudentSameSource,
    });
    const flaggedForReview = riskLevel === "high" || newOrUnrecognizedDevice;

    // 10. Late determination.
    const lateCutoffMs = startMs + LATE_GRACE_MINUTES * 60 * 1000;
    const status: AttendanceStatus = now.getTime() > lateCutoffMs ? "late" : "present";

    // 11. Final write, wrapped in a transaction keyed on the deterministic
    // record doc id so two concurrent requests for the same student+session
    // cannot both succeed — this IS the hard duplicate-prevention guarantee.
    const record = await db.runTransaction(async (tx) => {
      const snap = await tx.get(recordRef);
      if (snap.exists) {
        throw new AppError(409, "duplicate", "Attendance has already been recorded for this session.");
      }

      const data: AttendanceRecord = {
        recordId: recordRef.id,
        sessionId: body.sessionId,
        studentId: uid,
        studentName: student.name,
        rollNumber: student.rollNumber,
        status,
        markedBy: uid,
        markedByRole: "student",
        method: "self",
        verification,
        deviceId: body.deviceId,
        ...(ipAddress ? { ipAddress } : {}),
        timestamp: nowIso,
        riskScore,
        riskLevel,
        flaggedForReview,
      };
      tx.set(recordRef, data);

      const auditRef = db.collection("auditLogs").doc();
      tx.set(auditRef, {
        logId: auditRef.id,
        userId: uid,
        userRole: "student",
        action: "STUDENT_SELF_MARKED",
        timestamp: nowIso,
        targetId: data.recordId,
        targetType: "attendanceRecord",
        newValue: { status, riskScore, riskLevel, flaggedForReview },
        ipAddress,
      });

      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        notificationId: notifRef.id,
        userId: uid,
        type: "attendance_marked",
        title: "Attendance marked",
        message: `Your attendance for ${session.subjectName} was recorded as ${status}.`,
        timestamp: nowIso,
        read: false,
        relatedId: data.recordId,
      });

      if (riskLevel === "high") {
        const teacherNotifRef = db.collection("notifications").doc();
        tx.set(teacherNotifRef, {
          notificationId: teacherNotifRef.id,
          userId: session.teacherId,
          type: "suspicious_attempt",
          title: "Suspicious attendance attempt",
          message: `${student.name} (${student.rollNumber}) marked attendance for ${session.subjectName} with a high risk score (${riskScore}).`,
          timestamp: nowIso,
          read: false,
          relatedId: data.recordId,
        });
      }

      return data;
    });

    sendSuccess(res, record, 201);
  })
);

/**
 * POST /api/attendance/:recordId/correct
 * teacher|admin only (CRs cannot modify attendance without approval, per
 * spec). Requires a >=10 char reason. Blocked once the parent session is
 * locked unless the caller is admin.
 */
router.post(
  "/:recordId/correct",
  requireRole("teacher", "admin"),
  validateBody(correctAttendanceSchema),
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const body = req.body as CorrectAttendanceInput;

    const recordRef = db.collection("attendanceRecords").doc(recordId);
    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) {
      throw new AppError(404, "record_not_found", "Attendance record not found.");
    }
    const record = recordSnap.data() as AttendanceRecord;

    const sessionSnap = await db.collection("attendanceSessions").doc(record.sessionId).get();
    const session = sessionSnap.exists ? (sessionSnap.data() as AttendanceSession) : undefined;

    if (session?.status === "locked" && req.user!.role !== "admin") {
      throw new AppError(403, "session_locked", "This session is locked; only an admin can modify its attendance now.");
    }

    const now = new Date().toISOString();
    const previousStatus = record.status;

    await recordRef.update({
      status: body.newStatus,
      reason: body.reason,
      correctedAt: now,
      correctedBy: req.user!.uid,
    });

    const action: AuditAction = req.user!.role === "admin" ? "ADMIN_MODIFIED_ATTENDANCE" : "TEACHER_CHANGED_ATTENDANCE";
    await writeAuditLog({
      userId: req.user!.uid,
      userRole: req.user!.role,
      action,
      timestamp: now,
      targetId: recordId,
      targetType: "attendanceRecord",
      previousValue: { status: previousStatus },
      newValue: { status: body.newStatus },
      reason: body.reason,
      ipAddress: req.ip,
    });

    sendSuccess(res, { ...record, status: body.newStatus, reason: body.reason, correctedAt: now, correctedBy: req.user!.uid });
  })
);

export default router;
