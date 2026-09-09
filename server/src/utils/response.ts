import { Response } from "express";

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiEnvelope<T> = { success: true, data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): void {
  const body: ApiEnvelope<never> = {
    success: false,
    error: fieldErrors ? { code, message, fieldErrors } : { code, message },
  };
  res.status(status).json(body);
}

/**
 * Thrown from anywhere in a route/service to short-circuit with a specific
 * HTTP status + error code + message. Caught centrally by errorHandler.
 */
export class AppError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
