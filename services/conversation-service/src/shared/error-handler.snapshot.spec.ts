import { MulterError } from "multer";
import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { errorHandler, HttpError, notFoundHandler } from "./error-handler.js";

// Error bodies on the wire (docs/AICHAT-20, AICHAT-77): status and JSON the client gets
// for each kind of failure. The auth-service has the same table in its own spec.

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
  run({ correlationId: CORRELATION_ID } as unknown as Request, res);
  return out;
}

function handle(err: unknown) {
  return respond((req, res) => errorHandler(err, req, res, (() => undefined) as NextFunction));
}

describe("conversation-service error bodies", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "CHAT_NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "UNPROCESSABLE"],
    [500, "INTERNAL_ERROR"],
  ])("HttpError %i", (status, code) => {
    expect(handle(new HttpError(status, code, `message for ${code}`))).toMatchSnapshot();
  });

  it("validation error carries the field errors", () => {
    const result = z.object({ title: z.string().min(1), model: z.string() }).safeParse({ title: "" });
    expect(handle(result.error)).toMatchSnapshot();
  });

  it("upload rejected by multer", () => {
    expect(handle(new MulterError("LIMIT_FILE_SIZE"))).toMatchSnapshot();
  });

  it("unexpected error is redacted to a 500", () => {
    expect(handle(new Error("db connection string leaked"))).toMatchSnapshot();
  });

  it("unknown route", () => {
    expect(respond((req, res) => notFoundHandler(req, res))).toMatchSnapshot();
  });
});
