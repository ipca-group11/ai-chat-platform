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

/** Zod issues as `fieldErrors`. An unknown field of a strict object is reported under its own
 * name (Zod puts it on the parent object), so the client knows which field to remove. */
export function toFieldErrors(err: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  const add = (key: string, message: string) => {
    fieldErrors[key] = [...(fieldErrors[key] ?? []), message];
  };
  for (const issue of err.issues) {
    const prefix = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) add(prefix ? `${prefix}.${key}` : key, "Unknown field");
    } else {
      add(prefix || "_", issue.message);
    }
  }
  return fieldErrors;
}

/** Errors Express and its body parser raise before a route runs (malformed JSON, a body over the
 * limit, a path that cannot be decoded). They carry a 4xx `status`; their text is not sent back. */
function expressClientError(err: unknown): { status: number; code: string; message: string } | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { status, type } = err as { status?: unknown; type?: unknown };
  if (typeof status !== "number" || status < 400 || status > 499) return undefined;
  if (type === "entity.parse.failed") return { status: 400, code: "INVALID_JSON", message: "The request body is not valid JSON" };
  if (type === "entity.too.large") return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request body is too large" };
  return { status: 400, code: "BAD_REQUEST", message: "The request could not be read" };
}

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json(toErrorResponse("NOT_FOUND", "Resource not found", { correlationId: req.correlationId }));
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
    // when rejected by multer's own size ceiling before reaching our validator.
    req.log?.warn({ err }, "attachment upload rejected");
    res
      .status(400)
      .json(toErrorResponse("ATTACHMENT_UPLOAD_ERROR", err.message, { correlationId }));
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors = toFieldErrors(err);
    req.log?.warn({ err }, "validation failed");
    res
      .status(400)
      .json(toErrorResponse("VALIDATION_ERROR", "Request validation failed", { fieldErrors, correlationId }));
    return;
  }

  const clientError = expressClientError(err);
  if (clientError) {
    req.log?.warn({ err }, "request refused before reaching a route");
    res.status(clientError.status).json(toErrorResponse(clientError.code, clientError.message, { correlationId }));
    return;
  }

  req.log?.error({ err }, "unhandled error");
  res
    .status(500)
    .json(toErrorResponse("INTERNAL_ERROR", "An unexpected error occurred", { correlationId }));
}
