import { describe, expect, it } from "vitest";
import {
  CORRELATION_HEADER,
  errorResponseSchema,
  getOrCreateCorrelationId,
  toErrorResponse,
} from "./http.js";

describe("getOrCreateCorrelationId", () => {
  it("reuses the id from a header reader", () => {
    const headers = { get: (name: string) => (name === CORRELATION_HEADER ? "abc" : null) };
    expect(getOrCreateCorrelationId(headers)).toBe("abc");
  });

  it("generates an id when the header reader has none or an empty one", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(getOrCreateCorrelationId({ get: () => null })).toMatch(uuid);
    expect(getOrCreateCorrelationId({ get: () => "" })).toMatch(uuid);
  });

  it("reads the canonical or the lower-case key of a plain header record", () => {
    expect(getOrCreateCorrelationId({ [CORRELATION_HEADER]: "canon" })).toBe("canon");
    expect(getOrCreateCorrelationId({ [CORRELATION_HEADER.toLowerCase()]: "lower" })).toBe("lower");
  });

  it("takes the first value when the header is repeated", () => {
    expect(getOrCreateCorrelationId({ [CORRELATION_HEADER]: ["first", "second"] })).toBe("first");
  });

  it("generates a different id on each call when nothing is sent", () => {
    expect(getOrCreateCorrelationId({})).not.toBe(getOrCreateCorrelationId({}));
  });
});

describe("toErrorResponse", () => {
  it("builds the minimal body", () => {
    expect(toErrorResponse("E", "boom")).toEqual({ error: { code: "E", message: "boom" } });
  });

  it("adds field errors and the correlation id only when given", () => {
    const body = toErrorResponse("VALIDATION", "bad", {
      fieldErrors: { email: ["invalid"] },
      correlationId: "cid",
    });
    expect(body).toEqual({
      error: { code: "VALIDATION", message: "bad", fieldErrors: { email: ["invalid"] } },
      correlationId: "cid",
    });
    expect(errorResponseSchema.safeParse(body).success).toBe(true);
  });

  it("produces bodies the schema rejects when the shape is wrong", () => {
    expect(errorResponseSchema.safeParse({ error: { code: 1, message: "x" } }).success).toBe(false);
  });
});
