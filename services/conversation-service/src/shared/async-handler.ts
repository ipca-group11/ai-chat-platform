import type { NextFunction, Request, Response } from "express";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async Express handler so rejected promises reach `errorHandler` (Express 4
 * does not do this automatically). */
export function asyncHandler(handler: AsyncRequestHandler) {
  return function asyncHandlerWrapper(req: Request, res: Response, next: NextFunction) {
    handler(req, res, next).catch(next);
  };
}
