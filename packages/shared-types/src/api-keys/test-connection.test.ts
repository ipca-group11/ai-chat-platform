import { describe, expect, it } from "vitest";

import {
  SETTINGS_ROUTE_PATH,
  buildTestConnectionPath,
  testConnectionRequestSchema,
  testConnectionResponseSchema,
} from "./test-connection";

describe("testConnectionRequestSchema", () => {
  it("AC-85: accepts a request naming a valid provider", () => {
    expect(testConnectionRequestSchema.parse({ provider: "openai" })).toEqual({
      provider: "openai",
    });
  });

  it("AC-85: rejects a request with an unknown provider", () => {
    expect(() => testConnectionRequestSchema.parse({ provider: "bogus" })).toThrow();
  });
});

describe("testConnectionResponseSchema", () => {
  it("AC-85: accepts a success response", () => {
    expect(testConnectionResponseSchema.parse({ success: true })).toEqual({
      success: true,
    });
  });

  it("AC-85: accepts a failure response with a clear reason", () => {
    const response = testConnectionResponseSchema.parse({
      success: false,
      message: "Invalid API key",
    });
    expect(response).toEqual({ success: false, message: "Invalid API key" });
  });

  it("rejects a response missing the success flag", () => {
    expect(() => testConnectionResponseSchema.parse({ message: "oops" })).toThrow();
  });
});

describe("buildTestConnectionPath", () => {
  it("AC-85: builds a per-provider test-connection path", () => {
    expect(buildTestConnectionPath("openai")).toBe("/providers/openai/test-connection");
    expect(buildTestConnectionPath("anthropic")).toBe(
      "/providers/anthropic/test-connection",
    );
  });
});

describe("SETTINGS_ROUTE_PATH", () => {
  it("AC-86: exposes a stable route mfe-chat can link back to", () => {
    expect(SETTINGS_ROUTE_PATH).toBe("/settings");
  });
});
