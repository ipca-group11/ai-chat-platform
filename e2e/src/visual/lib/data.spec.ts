import { describe, expect, it } from "vitest";
import { CHATS, FIXED_TIME, MESSAGES, USER } from "./data.js";

describe("visual test data", () => {
  it("has a fixed clock and unique ids", () => {
    expect(new Date(FIXED_TIME).toISOString()).toBe(FIXED_TIME);
    expect(new Set(CHATS.map((c) => c.id)).size).toBe(CHATS.length);
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
  });

  it("keeps every timestamp in the past of the frozen clock, so no date reads as the future", () => {
    for (const value of [...CHATS.flatMap((c) => [c.createdAt, c.updatedAt]), ...MESSAGES.map((m) => m.createdAt)]) {
      expect(Date.parse(value)).toBeLessThanOrEqual(Date.parse(FIXED_TIME));
    }
  });

  it("belongs the chats to the signed-in user and the messages to a known chat", () => {
    expect(CHATS.every((c) => c.ownerId === USER.id)).toBe(true);
    const ids = new Set(CHATS.map((c) => c.id));
    expect(MESSAGES.every((m) => ids.has(m.chatId))).toBe(true);
  });

  it("covers reasoning, a fetched page and a failed fetch in the detail screen", () => {
    const reply = MESSAGES.find((m) => m.reasoning);
    expect(reply?.webFetches?.map((f) => f.status).sort()).toEqual(["done", "error"]);
  });
});
