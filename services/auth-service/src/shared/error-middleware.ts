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
    const fieldErrors = toFieldErrors(err);
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

  const clientError = expressClientError(err);
  if (clientError) {
    res
      .status(clientError.status)
      .json(http.toErrorResponse(clientError.code, clientError.message, { correlationId: req.correlationId }));
    return;
  }

  (req.log ?? logger).error(
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
