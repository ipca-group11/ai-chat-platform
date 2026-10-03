import { describe, expect, it } from "vitest";
import { sseEventSchema } from "./sse";

describe("sseEventSchema", () => {
  it("AC-8: accepts a token event", () => {
    const result = sseEventSchema.safeParse({
      type: "token",
      messageId: "msg-1",
      token: "Hel",
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: accepts a done event and rejects an unknown type", () => {
    expect(
      sseEventSchema.safeParse({ type: "done", messageId: "msg-1" }).success,
    ).toBe(true);
    expect(
      sseEventSchema.safeParse({ type: "unknown", messageId: "msg-1" }).success,
    ).toBe(false);
  });

  it("AC-8: discriminates error events requiring a message", () => {
    const result = sseEventSchema.safeParse({
      type: "error",
      messageId: "msg-1",
      message: "provider timeout",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a web fetch progress event", () => {
    const result = sseEventSchema.safeParse({
      type: "web_fetch",
      messageId: "msg-1",
      fetch: { id: "f1", url: "https://example.com", status: "done", title: "Example" },
    });
    expect(result.success).toBe(true);
  });
});
