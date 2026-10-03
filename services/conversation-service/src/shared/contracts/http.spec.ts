import { describe, expect, it } from "vitest";
import { CORRELATION_HEADER, getOrCreateCorrelationId, toErrorResponse } from "./http.js";

describe("getOrCreateCorrelationId", () => {
  it("reads the header via a HeaderReader-shaped object (e.g. the Fetch Headers API)", () => {
    const headers = { get: (name: string) => (name === CORRELATION_HEADER ? "reader-id" : null) };
    expect(getOrCreateCorrelationId(headers)).toBe("reader-id");
  });

  it("takes the first value when the header is an array", () => {
    const headers = { [CORRELATION_HEADER]: ["first-id", "second-id"] };
    expect(getOrCreateCorrelationId(headers)).toBe("first-id");
  });

  it("generates a new id when the header is absent from a HeaderReader", () => {
    const headers = { get: () => null };
    expect(getOrCreateCorrelationId(headers)).toBeTruthy();
  });

  it("falls back to the lowercase header key on a plain object", () => {
    const headers = { [CORRELATION_HEADER.toLowerCase()]: "lowercase-id" };
    expect(getOrCreateCorrelationId(headers)).toBe("lowercase-id");
  });
});

describe("toErrorResponse", () => {
  it("omits fieldErrors and correlationId when not provided", () => {
    const response = toErrorResponse("SOME_CODE", "some message");
    expect(response).toEqual({ error: { code: "SOME_CODE", message: "some message" } });
  });

  it("includes fieldErrors and correlationId when provided", () => {
    const response = toErrorResponse("SOME_CODE", "some message", {
      fieldErrors: { title: ["required"] },
      correlationId: "corr-1",
    });
    expect(response).toEqual({
      error: { code: "SOME_CODE", message: "some message", fieldErrors: { title: ["required"] } },
      correlationId: "corr-1",
    });
  });
});
