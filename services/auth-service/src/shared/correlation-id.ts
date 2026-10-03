/**
 * Correlation-id middleware (STACK.md decision #8, ARCHITECTURE.md §7). Reads
 * `X-Correlation-Id` from the incoming request, or generates one if absent, attaches it
 * to `req.correlationId` for downstream handlers/logging, and echoes it back on the
 * response.
 */
import type { NextFunction, Request, Response } from "express";
import { http } from "./contracts/index.js";

// See the comment in `../features/session/verify.ts` on why this augments the global
// `Express.Request` namespace rather than `declare module "express-serve-static-core"`.
declare global {
  // Required TS pattern for augmenting Express's ambient `Express.Request` global
  // namespace; not a "normal" TS namespace as an ES2015-module alternative.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = http.getOrCreateCorrelationId(req.headers);
  req.correlationId = correlationId;
  res.setHeader(http.CORRELATION_HEADER, correlationId);
  next();
}
