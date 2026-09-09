import { Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebaseAdmin";
import { requireRole } from "../middleware/roleMiddleware";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/response";
import { createSessionSchema } from "../schemas/sessionSchemas";
import { getAttendancePolicy } from "../services/policyService";
import { writeAuditLog } from "../services/auditService";
import { AttendanceSession } from "../types";

const router = Router();

/**
 * POST /api/sessions
 * Creates a new attendance session. Location + QR fields are RESOLVED
 * server-side (never trust a client-computed qrToken/expiry or a
 * client-asserted location default) so this is the single source of truth
 * teachers/students verify against later.
 */
router.post(
  "/",
  requireRole("teacher", "cr", "admin"),
  validateBody(createSessionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import("../schemas/sessionSchemas").CreateSessionInput;
    const policy = await getAttendancePolicy();

    // A teacher can only ever create sessions attributed to themselves —
    // this stops a malicious "teacher" caller from attributing a session to
    // a different teacherId in the request body. CR/admin may create on
    // behalf of a specified teacher, since they are not the session owner.
    const teacherId = req.user!.role === "teacher" ? req.user!.uid : body.teacherId;
    const teacherName = req.user!.role === "teacher" ? req.user!.name : body.teacherName;

    let location: { latitude: number; longitude: number } | undefined;
    let radiusMeters: number | undefined;

    if (body.verificationMethods.includes("location")) {
      if (body.useCollegeDefaultLocation) {
        location = policy.collegeLocation;
        radiusMeters = body.radiusMeters ?? policy.geofenceRadiusMeters;
      } else {
        // Validated as required-together by the zod schema when this branch is reached.
        location = { latitude: body.latitude as number, longitude: body.longitude as number };
        radiusMeters = body.radiusMeters as number;
      }
    } else if (body.useCollegeDefaultLocation) {
      // Location verification not requested, but still record a location
      // for reference/consistency if the caller opted into the default.
      location = policy.collegeLocation;
      radiusMeters = body.radiusMeters ?? policy.geofenceRadiusMeters;
    }

    let qrToken: string | undefined;
    let qrExpiresAt: string | undefined;
    if (body.verificationMethods.includes("qr")) {
      qrToken = crypto.randomBytes(16).toString("hex");
      qrExpiresAt = new Date(Date.now() + policy.qrTokenTtlSeconds * 1000).toISOString();
    }

    // Count students in the target division for totalStudents.
    const studentsSnap = await db
      .collection("students")
      .where("divisionId", "==", body.divisionId)
      .where("classId", "==", body.classId)
      .get();
    const totalStudents = studentsSnap.size;

    const sessionRef = db.collection("attendanceSessions").doc();
    const now = new Date().toISOString();

    const session: AttendanceSession = {
      sessionId: sessionRef.id,
      subjectId: body.subjectId,
      subjectName: body.subjectName,
      teacherId,
      teacherName,
      classId: body.classId,
      divisionId: body.divisionId,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      verificationMethods: body.verificationMethods,
      ...(location ? { location } : {}),
      ...(radiusMeters !== undefined ? { radiusMeters } : {}),
      status: "open",
      ...(qrToken ? { qrToken } : {}),
      ...(qrExpiresAt ? { qrExpiresAt } : {}),
      createdBy: req.user!.uid,
      createdAt: now,
      totalStudents,
    };

    await sessionRef.set(session);

    await writeAuditLog({
      userId: req.user!.uid,
      userRole: req.user!.role,
      action: "SESSION_CREATED",
      timestamp: now,
      targetId: session.sessionId,
      targetType: "session",
      newValue: { status: session.status, subjectId: session.subjectId, divisionId: session.divisionId },
      ipAddress: req.ip,
    });

    sendSuccess(res, session, 201);
  })
);

/** Loads a session or throws 404. */
async function loadSessionOrThrow(sessionId: string): Promise<AttendanceSession> {
  const snap = await db.collection("attendanceSessions").doc(sessionId).get();
  if (!snap.exists) {
    throw new AppError(404, "session_not_found", "Attendance session not found.");
  }
  return snap.data() as AttendanceSession;
}

/** Admin always passes; teacher must be the session's own teacher; cr is allowed by role gate alone. */
function assertSessionOwnerOrAdmin(session: AttendanceSession, user: { uid: string; role: string }): void {
  if (user.role === "admin") return;
  if (user.role === "teacher" && session.teacherId === user.uid) return;
  if (user.role === "cr") return;
  throw new AppError(403, "not_session_owner", "You do not have permission to modify this session.");
}

/**
 * POST /api/sessions/:sessionId/qr/rotate
 * Regenerates the QR token + expiry on an open session. Only the owning
 * teacher or an admin may rotate it.
 */
router.post(
  "/:sessionId/qr/rotate",
  requireRole("teacher", "cr", "admin"),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await loadSessionOrThrow(sessionId);

    if (req.user!.role !== "admin" && session.teacherId !== req.user!.uid) {
      throw new AppError(403, "not_session_owner", "Only the session's teacher or an admin can rotate its QR code.");
    }

    const policy = await getAttendancePolicy();
    const qrToken = crypto.randomBytes(16).toString("hex");
    const qrExpiresAt = new Date(Date.now() + policy.qrTokenTtlSeconds * 1000).toISOString();

    await db.collection("attendanceSessions").doc(sessionId).update({ qrToken, qrExpiresAt });

    sendSuccess(res, { qrToken, qrExpiresAt });
  })
);

/**
 * POST /api/sessions/:sessionId/finalize
 * Moves a session from "open" to "finalized". 409 if not currently open.
 */
router.post(
  "/:sessionId/finalize",
  requireRole("teacher", "cr", "admin"),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await loadSessionOrThrow(sessionId);
    assertSessionOwnerOrAdmin(session, req.user!);

    if (session.status !== "open") {
      throw new AppError(409, "invalid_session_state", `Session cannot be finalized because its status is '${session.status}', not 'open'.`);
    }

    const now = new Date().toISOString();
    await db.collection("attendanceSessions").doc(sessionId).update({
      status: "finalized",
      finalizedAt: now,
      finalizedBy: req.user!.uid,
    });

    await writeAuditLog({
      userId: req.user!.uid,
      userRole: req.user!.role,
      action: "SESSION_FINALIZED",
      timestamp: now,
      targetId: sessionId,
      targetType: "session",
      previousValue: { status: "open" },
      newValue: { status: "finalized" },
      ipAddress: req.ip,
    });

    sendSuccess(res, { ...session, status: "finalized", finalizedAt: now, finalizedBy: req.user!.uid });
  })
);

/**
 * POST /api/sessions/:sessionId/lock
 * Moves a session from "finalized" to "locked". Irreversible. 409 if not
 * currently finalized. teacher|admin only (cr cannot lock).
 */
router.post(
  "/:sessionId/lock",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await loadSessionOrThrow(sessionId);
    assertSessionOwnerOrAdmin(session, req.user!);

    if (session.status !== "finalized") {
      throw new AppError(409, "invalid_session_state", `Session cannot be locked because its status is '${session.status}', not 'finalized'.`);
    }

    const now = new Date().toISOString();
    await db.collection("attendanceSessions").doc(sessionId).update({
      status: "locked",
      lockedAt: now,
      lockedBy: req.user!.uid,
    });

    await writeAuditLog({
      userId: req.user!.uid,
      userRole: req.user!.role,
      action: "SESSION_LOCKED",
      timestamp: now,
      targetId: sessionId,
      targetType: "session",
      previousValue: { status: "finalized" },
      newValue: { status: "locked" },
      ipAddress: req.ip,
    });

    sendSuccess(res, { ...session, status: "locked" });
  })
);

export default router;
