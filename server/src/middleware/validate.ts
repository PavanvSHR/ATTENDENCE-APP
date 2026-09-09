import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { sendError } from "../utils/response";

/**
 * Validates req.body against the given zod schema. On failure, responds
 * 400 with per-field error messages and never reaches the route handler.
 * On success, req.body is REPLACED with the parsed (and coerced/defaulted)
 * value so handlers can trust its shape.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      sendError(res, 400, "validation_error", "Request body failed validation.", fieldErrors);
      return;
    }
    req.body = result.data;
    next();
  };
}
