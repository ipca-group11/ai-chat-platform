import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { CORRELATION_HEADER, getOrCreateCorrelationId } from "./correlation-header.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Correlation ID for this request (present + echoed on the response, AC-89). */
    correlationId?: string;
    /** Child logger bound to `correlationId`, for handlers/services to log with (AC-88). */
    log?: Logger;
  }
}

/**
 * Express middleware (AC-88/AC-89): reads `X-Correlation-Id` off the incoming request,
 * generating a UUID via `getOrCreateCorrelationId` when absent, attaches it to
 * `req.correlationId`, binds a child logger (`req.log`) carrying that ID on every line it
 * emits, and echoes the header back on the response so the caller can correlate its own
 * logs with the server's.
 */
export function correlationMiddleware(rootLogger: Logger) {
  return function correlationMiddlewareHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId = getOrCreateCorrelationId(
      req.headers as Record<string, string | string[] | undefined>,
    );

    req.correlationId = correlationId;
    req.log = rootLogger.child({ correlationId });
    res.setHeader(CORRELATION_HEADER, correlationId);

    next();
  };
}
