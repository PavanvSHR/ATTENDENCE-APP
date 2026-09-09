import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebaseAdmin";
import { requireRole } from "../middleware/roleMiddleware";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/response";
import { registerDeviceSchema, RegisterDeviceInput } from "../schemas/deviceSchemas";
import { writeAuditLog } from "../services/auditService";
import { RegisteredDevice, StudentRecord } from "../types";

const router = Router();

/**
 * POST /api/devices/register
 * Explicit device registration for the signed-in student, called once on
 * first use of the attendance flow (see student module's
 * `studentAttendanceService.registerDevice`). The FIRST device on an account
 * is auto-verified; any device registered after that comes back
 * `status:"pending"` — extra scrutiny, not a hard block (mirrors the
 * bootstrap logic already applied inline in POST /attendance/self for a
 * device that shows up unannounced).
 */
router.post(
  "/register",
  requireRole("student"),
  validateBody(registerDeviceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as RegisterDeviceInput;
    const uid = req.user!.uid;
    const now = new Date().toISOString();

    const studentRef = db.collection("students").doc(uid);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      throw new AppError(404, "student_not_found", "Your student profile could not be found. Contact your administrator.");
    }
    const student = studentSnap.data() as StudentRecord;
    const registeredDeviceIds = student.registeredDeviceIds ?? [];

    const deviceRef = db.collection("devices").doc();
    const isFirstDevice = registeredDeviceIds.length === 0;

    const device: RegisteredDevice = {
      deviceId: deviceRef.id,
      userId: uid,
      label: body.label,
      platform: body.platform,
      status: isFirstDevice ? "verified" : "pending",
      firstSeenAt: now,
      lastUsedAt: now,
    };

    await deviceRef.set(device);
    await studentRef.update({ registeredDeviceIds: FieldValue.arrayUnion(deviceRef.id) });

    await writeAuditLog({
      userId: uid,
      userRole: "student",
      action: "DEVICE_REGISTERED",
      timestamp: now,
      targetId: deviceRef.id,
      targetType: "device",
      newValue: { label: body.label, platform: body.platform, status: device.status },
      ipAddress: req.ip,
    });

    sendSuccess(res, device, 201);
  })
);

export default router;
