import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { errorMiddleware, HttpError, notFoundMiddleware } from "./error-middleware.js";

// Error bodies on the wire (docs/AICHAT-20, AICHAT-77): status and JSON the client gets
// for each kind of failure. The conversation-service has the same table in its own spec.

const CORRELATION_ID = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";

function respond(run: (req: Request, res: Response) => void): { status: number; body: unknown } {
  const out = { status: 0, body: undefined as unknown };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  } as unknown as Response;
  run({ correlationId: CORRELATION_ID, path: "/auth/login" } as unknown as Request, res);
  return out;
}

function handle(err: unknown) {
  return respond((req, res) => errorMiddleware(err, req, res, (() => undefined) as NextFunction));
}

describe("auth-service error bodies", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "INVALID_CREDENTIALS"],
    [403, "FORBIDDEN"],
    [404, "USER_NOT_FOUND"],
    [409, "EMAIL_TAKEN"],
    [422, "UNPROCESSABLE"],
    [500, "INTERNAL_ERROR"],
  ])("HttpError %i", (status, code) => {
    expect(handle(new HttpError(status, code, `message for ${code}`))).toMatchSnapshot();
  });

  it("validation error carries the field errors", () => {
    const result = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse({
      email: "not-an-email",
      password: "short",
    });
    expect(handle(result.error)).toMatchSnapshot();
  });

  it("unexpected error is redacted to a 500", () => {
    expect(handle(new Error("db connection string leaked"))).toMatchSnapshot();
  });

  it("unknown route", () => {
    expect(respond((req, res) => notFoundMiddleware(req, res))).toMatchSnapshot();
  });
});
