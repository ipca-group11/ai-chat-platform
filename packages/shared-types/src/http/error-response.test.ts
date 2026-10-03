import { describe, expect, it } from "vitest";
import { errorResponseSchema, toErrorResponse } from "./error-response";

describe("errorResponseSchema", () => {
  it("AC-8: accepts a minimal error body", () => {
    const result = errorResponseSchema.safeParse({
      error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: accepts field errors and a correlation id", () => {
    const result = errorResponseSchema.safeParse({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid payload",
        fieldErrors: { password: ["Password must contain at least one number"] },
      },
      correlationId: "abc-123",
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects a body missing the error code", () => {
    const result = errorResponseSchema.safeParse({ error: { message: "oops" } });
    expect(result.success).toBe(false);
  });
});

describe("toErrorResponse", () => {
  it("AC-8: builds a valid error response accepted by the schema", () => {
    const body = toErrorResponse("NOT_FOUND", "Chat not found", {
      correlationId: "corr-1",
    });
    expect(errorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "Chat not found" },
      correlationId: "corr-1",
    });
  });

  it("AC-8: omits fieldErrors and correlationId when no options are given", () => {
    const body = toErrorResponse("INTERNAL_ERROR", "Something went wrong");
    expect(errorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  it("AC-8: includes fieldErrors when provided", () => {
    const body = toErrorResponse("VALIDATION_ERROR", "Invalid payload", {
      fieldErrors: { email: ["Invalid email"] },
    });
    expect(errorResponseSchema.safeParse(body).success).toBe(true);
    expect(body.error.fieldErrors).toEqual({ email: ["Invalid email"] });
  });
});
