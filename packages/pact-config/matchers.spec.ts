import { describe, expect, it } from "vitest";
import {
  CORRELATION_HEADER,
  correlationHeaderMatcher,
  eachLike,
  errorResponseMatcher,
  fieldErrorsMatcher,
  like,
  term,
} from "./matchers.js";

describe("re-exported matchers (AC-95)", () => {
  it("AC-95: like wraps a value with a Pact matcher", () => {
    const matcher = like("hello") as { value: unknown };
    expect(matcher.value).toBe("hello");
  });

  it("AC-95: eachLike produces an array matcher with at least one example", () => {
    const matcher = eachLike("item") as { value: unknown[] };
    expect(Array.isArray(matcher.value)).toBe(true);
    expect(matcher.value[0]).toBe("item");
  });

  it("AC-95: term builds a regex matcher with the given example value", () => {
    const matcher = term("[0-9]+", "42") as { value: unknown };
    expect(matcher.value).toBe("42");
  });
});

describe("correlationHeaderMatcher (AC-95)", () => {
  it("AC-95: CORRELATION_HEADER matches STACK.md decision #8", () => {
    expect(CORRELATION_HEADER).toBe("X-Correlation-Id");
  });

  it("AC-95: produces a UUID-shaped example value", () => {
    const matcher = correlationHeaderMatcher() as { value: string };
    expect(matcher.value).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("errorResponseMatcher (AC-95)", () => {
  it("AC-95: matches the shared error envelope shape with a default code", () => {
    const matcher = errorResponseMatcher() as {
      error: { code: { value: string }; message: { value: string } };
    };
    expect(matcher.error.code.value).toBe("BAD_REQUEST");
    expect(matcher.error.message.value).toBeTruthy();
  });

  it("AC-95: honors a caller-supplied error code", () => {
    const matcher = errorResponseMatcher({ code: "UNAUTHORIZED" }) as {
      error: { code: { value: string } };
    };
    expect(matcher.error.code.value).toBe("UNAUTHORIZED");
  });
});

describe("fieldErrorsMatcher (AC-95)", () => {
  it("AC-95: matches the field-errors envelope for a given field", () => {
    const matcher = fieldErrorsMatcher("password") as {
      error: { fieldErrors: Record<string, { value: unknown[] }> };
    };
    expect(matcher.error.fieldErrors["password"]?.value).toEqual(["must be a valid value"]);
  });

  it("AC-95: defaults to the email field when none is supplied", () => {
    const matcher = fieldErrorsMatcher() as {
      error: { fieldErrors: Record<string, unknown> };
    };
    expect(Object.keys(matcher.error.fieldErrors)).toEqual(["email"]);
  });
});
