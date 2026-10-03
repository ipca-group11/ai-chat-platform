import type { NextFunction, Request, Response } from "express";
import { CORRELATION_HEADER, getOrCreateCorrelationId } from "./contracts/http.js";
import type { Logger } from "./logger.js";

// See the comment in `./auth-middleware.ts` on why this augments the global
// `Express.Request` namespace rather than `declare module "express-serve-static-core"`.
declare global {
  // Required TS pattern for augmenting Express's ambient `Express.Request` global
  // namespace; not a "normal" TS namespace as an ES2015-module alternative.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      log: Logger;
    }
  }
}

/**
 * Reads (or generates) the `X-Correlation-Id` header, attaches it to `req`, echoes it
 * back on the response, and binds a child logger carrying it for the request lifetime
 * (ARCHITECTURE.md §7, STACK.md decision #8).
 */
export function correlationMiddleware(baseLogger: Logger) {
  return function correlationMiddlewareHandler(req: Request, res: Response, next: NextFunction) {
    const correlationId = getOrCreateCorrelationId(req.headers as Record<string, string | string[] | undefined>);
    req.correlationId = correlationId;
    req.log = baseLogger.child({ correlationId });
    res.setHeader(CORRELATION_HEADER, correlationId);
    next();
  };
}
