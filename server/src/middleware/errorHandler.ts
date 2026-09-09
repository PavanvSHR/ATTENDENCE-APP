import { NextFunction, Request, Response } from "express";
import { AppError, sendError } from "../utils/response";

/**
 * Final Express error handler. Must be mounted LAST, after all routes.
 * Produces the {success:false,error} envelope for every failure path and
 * NEVER leaks stack traces / internal error details to the client — those
 * are logged server-side only.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      console.error(`[${req.method} ${req.path}] AppError:`, err);
    }
    sendError(res, err.status, err.code, err.message, err.fieldErrors);
    return;
  }

  console.error(`[${req.method} ${req.path}] Unhandled error:`, err);
  sendError(res, 500, "internal_error", "An unexpected error occurred. Please try again later.");
}
