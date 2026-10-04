import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./async-handler.js";

const req = {} as Request;
const res = {} as Response;

describe("asyncHandler", () => {
  it("passes req, res and next to the wrapped handler and does not call next when it resolves", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const handler = vi.fn().mockResolvedValue(undefined);

    asyncHandler(handler)(req, res, next);
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards a rejected promise to next", async () => {
    const error = new Error("boom");
    const next = vi.fn();

    asyncHandler(() => Promise.reject(error))(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("forwards an error thrown inside an async handler to next", async () => {
    const error = new Error("thrown");
    const next = vi.fn();

    asyncHandler(async () => {
      throw error;
    })(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledExactlyOnceWith(error);
  });
});
