import { describe, expect, it, vi } from "vitest";
import { MulterError } from "multer";
import { z } from "zod";
import type { Request, Response } from "express";
import { errorHandler, HttpError, isMalformedJsonBody, notFoundHandler } from "./error-handler.js";

function makeRes(): Response {
  const res = {
    statusCode: 200,
    status: vi.fn().mockImplementation(function (this: Response, code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("errorHandler", () => {
  it("AC-46: maps HttpError to its status code and uniform body", () => {
    const req = { correlationId: "corr-1", log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = makeRes();
    const err = new HttpError(404, "CHAT_NOT_FOUND", "Chat not found");

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: { code: "CHAT_NOT_FOUND", message: "Chat not found" }, correlationId: "corr-1" }),
    );
  });

  it("AC-42: maps ZodError to a 400 with field errors", () => {
    const req = { correlationId: "corr-2", log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = makeRes();
    const schema = z.object({ title: z.string().min(1) });
    const result = schema.safeParse({ title: "" });

    errorHandler(result.error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("AC-72: maps unknown errors to a redacted 500 without crashing the process", () => {
    const req = { correlationId: "corr-3", log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = makeRes();

    errorHandler(new Error("db connection string leaked"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const [body] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0] as [{ error: { message: string } }];
    expect(body.error.message).not.toContain("leaked");
  });

  it("maps the body parser's malformed-JSON error to a 400 VALIDATION_ERROR without logging the body (AICHAT-217)", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const req = { correlationId: "corr-6", log } as unknown as Request;
    const res = makeRes();
    const err = Object.assign(new SyntaxError("Unexpected token in JSON"), { type: "entity.parse.failed", body: '{"title":"private' });

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "VALIDATION_ERROR", message: "Request body is not valid JSON" },
      correlationId: "corr-6",
    });
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain("private");
  });

  it("only the body parser's error counts as malformed JSON; any other SyntaxError is a 500", () => {
    expect(isMalformedJsonBody(Object.assign(new SyntaxError("x"), { type: "entity.parse.failed" }))).toBe(true);
    expect(isMalformedJsonBody(new SyntaxError("x"))).toBe(false);
    expect(isMalformedJsonBody(Object.assign(new Error("x"), { type: "entity.parse.failed" }))).toBe(false);

    const res = makeRes();
    errorHandler(new SyntaxError("bug in our code"), { log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("AC-68/AICHAT-218: maps multer's size limit to a 413 ATTACHMENT_TOO_LARGE", () => {
    const req = { correlationId: "corr-5", log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = makeRes();

    errorHandler(new MulterError("LIMIT_FILE_SIZE"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "ATTACHMENT_TOO_LARGE" }) }),
    );
  });

  it("AC-68: maps any other MulterError to a 400 with a clear message", () => {
    const req = { correlationId: "corr-5", log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = makeRes();
    const err = new MulterError("LIMIT_UNEXPECTED_FILE", "attachment");

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "ATTACHMENT_UPLOAD_ERROR" }) }),
    );
  });

  it("AC-46: notFoundHandler returns a 404 envelope", () => {
    const req = { correlationId: "corr-4" } as Request;
    const res = makeRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
