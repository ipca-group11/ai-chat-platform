import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { toErrorResponse } from "./contracts/http.js";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(statusCode: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json(toErrorResponse("NOT_FOUND", "Resource not found", { correlationId: req.correlationId }));
}

/** The error `express.json()` raises for a body it cannot parse (a client error, not a 500: AICHAT-217). */
export function isMalformedJsonBody(err: unknown): boolean {
  return err instanceof SyntaxError && (err as SyntaxError & { type?: unknown }).type === "entity.parse.failed";
}

/** Uniform error-handling middleware (ARCHITECTURE.md §7): every error becomes the
 * shared `{ error: { code, message } }` shape, redacting internals for 5xx. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.correlationId;

  if (err instanceof HttpError) {
    req.log?.warn({ err, statusCode: err.statusCode }, "request failed");
    res
      .status(err.statusCode)
      .json(toErrorResponse(err.code, err.message, { fieldErrors: err.fieldErrors, correlationId }));
    return;
  }

  if (err instanceof MulterError) {
    // AC-68: files rejected before upload get a clear, specific error message, even
    // when rejected by multer's own size ceiling before reaching our validator. A file
    // over the size limit is a 413, like the one the validator answers (AICHAT-218).
    req.log?.warn({ err }, "attachment upload rejected");
    if (err.code === "LIMIT_FILE_SIZE") {
      res
        .status(413)
        .json(toErrorResponse("ATTACHMENT_TOO_LARGE", "The file exceeds the upload size limit", { correlationId }));
      return;
    }
    res
      .status(400)
      .json(toErrorResponse("ATTACHMENT_UPLOAD_ERROR", err.message, { correlationId }));
    return;
  }

  if (isMalformedJsonBody(err)) {
    // Not the error itself: its message and `body` carry the raw request body, which may hold personal data.
    req.log?.warn("malformed JSON body");
    res
      .status(400)
      .json(toErrorResponse("VALIDATION_ERROR", "Request body is not valid JSON", { correlationId }));
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    req.log?.warn({ err }, "validation failed");
    res
      .status(400)
      .json(toErrorResponse("VALIDATION_ERROR", "Request validation failed", { fieldErrors, correlationId }));
    return;
  }

  req.log?.error({ err }, "unhandled error");
  res
    .status(500)
    .json(toErrorResponse("INTERNAL_ERROR", "An unexpected error occurred", { correlationId }));
}
