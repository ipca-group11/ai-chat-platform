import { describe, expect, it } from "vitest";
import { sendMessageSchema, editMessageSchema } from "./schema.js";

describe("messages schema", () => {
  it("AC-51: rejects an empty message body", () => {
    const result = sendMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("AC-66: accepts a list of attachment ids", () => {
    const result = sendMessageSchema.safeParse({ content: "hi", attachmentIds: ["a1", "a2"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachmentIds).toEqual(["a1", "a2"]);
    }
  });

  it("AC-51: attachmentIds defaults to an empty array", () => {
    const result = sendMessageSchema.safeParse({ content: "hi" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachmentIds).toEqual([]);
    }
  });

  it("AC-58: edit schema rejects an empty content", () => {
    const result = editMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});
