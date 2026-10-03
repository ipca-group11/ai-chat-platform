/**
 * Uniform error handling: a typed `HttpError` for expected failures (validation,
 * duplicate email, invalid credentials, ...) plus an Express error middleware that
 * normalizes any thrown error into the `http.toErrorResponse` shape, echoing the
 * request's correlation id.
 */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { http } from "./contracts/index.js";
import { logger } from "./logger.js";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function notFoundMiddleware(req: Request, res: Response): void {
  res
    .status(404)
    .json(
      http.toErrorResponse("NOT_FOUND", "Not found", {
        correlationId: req.correlationId,
      }),
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires 4-arg error middleware signature
export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json(
        http.toErrorResponse(err.code, err.message, {
          fieldErrors: err.fieldErrors,
          correlationId: req.correlationId,
        }),
      );
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    res
      .status(400)
      .json(
        http.toErrorResponse("VALIDATION_ERROR", "Invalid request", {
          fieldErrors,
          correlationId: req.correlationId,
        }),
      );
    return;
  }

  logger.error(
    { err, correlationId: req.correlationId, path: req.path },
    "Unhandled error",
  );
  res
    .status(500)
    .json(
      http.toErrorResponse("INTERNAL_ERROR", "Internal server error", {
        correlationId: req.correlationId,
      }),
    );
}
