import { NextFunction, Request, Response } from "express";
import { UserRole } from "../types";

/**
 * Sign-in/roles have been removed app-wide (see authMiddleware.ts) — every
 * caller shares one fixed admin identity with full access, so this no
 * longer restricts anything. Kept as a no-op passthrough, rather than
 * deleting it and its call sites, so route definitions still read the
 * same and can have real role checks restored later.
 */
export function requireRole(..._roles: UserRole[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}
