import { NextFunction, Request, Response } from "express";

/**
 * Express 4 does not catch rejected promises from async route handlers —
 * without this wrapper a thrown/rejected AppError would crash the process
 * instead of reaching errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
