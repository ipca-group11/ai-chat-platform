import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/error-handler.js";

/** Guards the internal routes: the caller must send `Authorization: Bearer <token>` with the
 * service token shared through the environment. The comparison takes the same time whatever
 * the first differing byte is. */
export function requireServiceToken(expected: string) {
  const expectedBytes = Buffer.from(expected);
  return function requireServiceTokenHandler(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization ?? "";
    const presented = header.startsWith("Bearer ") ? Buffer.from(header.slice("Bearer ".length)) : Buffer.alloc(0);
    const ok = presented.length === expectedBytes.length && timingSafeEqual(presented, expectedBytes);
    if (!ok) {
      next(new HttpError(401, "UNAUTHENTICATED", "Missing or invalid service token"));
      return;
    }
    next();
  };
}
