import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { ZodError } from "zod";
import { z } from "zod";
import { errorMiddleware, HttpError, notFoundMiddleware } from "./error-middleware.js";

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status: vi.fn(function (this: Response, code: number) {
      res.statusCode = code;
      return res as unknown as Response;
    }),
    json: vi.fn(function (this: Response, body: unknown) {
      res.body = body;
      return res as unknown as Response;
    }),
  };
  return res;
}

function mockReq(correlationId = "corr-1"): Request {
  return { correlationId, path: "/auth/register" } as unknown as Request;
}

describe("errorMiddleware", () => {
  it("formats an HttpError with its status/code/message/fieldErrors", () => {
    const res = mockRes();
    const err = new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists", {
      email: ["An account with this email already exists"],
    });

    errorMiddleware(err, mockReq(), res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      error: {
        code: "EMAIL_TAKEN",
        message: "An account with this email already exists",
        fieldErrors: { email: ["An account with this email already exists"] },
      },
      correlationId: "corr-1",
    });
  });

  it("formats a ZodError as a 400 VALIDATION_ERROR", () => {
    const res = mockRes();
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);

    errorMiddleware(result.error as ZodError, mockReq(), res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });

  it("falls back to a 500 INTERNAL_ERROR for unexpected errors", () => {
    const res = mockRes();

    errorMiddleware(new Error("boom"), mockReq(), res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe("INTERNAL_ERROR");
  });

  it("notFoundMiddleware returns a 404 NOT_FOUND", () => {
    const res = mockRes();

    notFoundMiddleware(mockReq(), res as unknown as Response);

    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });
});
