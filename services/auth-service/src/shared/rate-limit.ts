import type { NextFunction, Request, Response } from "express";
import type { Options } from "express-rate-limit";
import { http } from "./contracts/index.js";

/** `handler` of every rate limiter: a 429 with the shared error envelope and the correlation id,
 * like any other error (AICHAT-185). The library's default answers with plain text. */
export function rateLimitedHandler(req: Request, res: Response, _next: NextFunction, options: Options): void {
  res
    .status(options.statusCode)
    .json(http.toErrorResponse("RATE_LIMITED", "Too many requests, please try again later", { correlationId: req.correlationId }));
}
