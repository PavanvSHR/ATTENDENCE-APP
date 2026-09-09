import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { sendError } from "../utils/response";

function rateLimitHandler(req: Request, res: Response): void {
  sendError(res, 429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
}

/** Generic limiter applied to the whole /api surface. */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Stricter limiter specifically for POST /api/attendance/self — bounds
 * rapid repeated self-marking attempts per (uid + ip), which is itself one
 * of the risk-scoring signals called out in the spec (abuse/proxy attempts
 * tend to hammer this endpoint). Keyed by uid when authenticated (falls
 * back to ip pre-auth, though authMiddleware runs before this in practice).
 */
export const selfAttendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const uid = req.user?.uid;
    return uid ? `${uid}:${req.ip}` : req.ip || "unknown";
  },
  handler: rateLimitHandler,
});
