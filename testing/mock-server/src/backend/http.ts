import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import type { ZodError } from "zod";

/** Expected failure; becomes the `{ error: { code, message, fieldErrors? }, correlationId }` body. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const CORRELATION_HEADER = "x-correlation-id";

/** The real services echo the caller's correlation id, or make one up when there is none. */
export function correlationIdOf(req: Request): string {
  const header = req.headers[CORRELATION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.length > 0 ? value : randomUUID();
}

/** Writes the error body shared by auth-service and conversation-service. */
export function sendError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): void {
  res.status(status).json({
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
    correlationId: correlationIdOf(req),
  });
}

/** zod issues grouped by field path (`_` when the issue is on the body itself). */
export function fieldErrorsOf(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

/** Error middleware of a backend mock; `internalMessage` is the text of the real service's 500. */
export function errorHandler(internalMessage: string): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    if (err instanceof HttpError) {
      sendError(req, res, err.status, err.code, err.message, err.fieldErrors);
      return;
    }
    if (err instanceof SyntaxError) {
      sendError(req, res, 400, "VALIDATION_ERROR", "Request body is not valid JSON");
      return;
    }
    sendError(req, res, 500, "INTERNAL_ERROR", internalMessage);
  };
}

/** Minimal Cookie header parser. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

/** Lets a frontend on another origin (a dev server) call the mock with its cookies. */
export const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

/** Path of the request without its query string, as the client wrote it. */
export function pathOf(req: Request): string {
  return req.originalUrl.split("?")[0] ?? "/";
}
