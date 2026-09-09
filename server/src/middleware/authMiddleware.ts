import { NextFunction, Request, Response } from "express";

/**
 * Sign-in has been removed app-wide: every request is treated as this one
 * fixed admin identity, with no ID token verification. req.user still gets
 * populated so downstream handlers/audit logging (which read req.user.uid/
 * role/name) keep working unchanged.
 */
const SHARED_USER = {
  uid: "shared-admin",
  role: "admin" as const,
  name: "Admin",
  email: "admin@local",
};

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  req.user = SHARED_USER;
  next();
};
