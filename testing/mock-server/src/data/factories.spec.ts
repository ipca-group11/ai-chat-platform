import { chat } from "@app/shared-types";
import { describe, expect, it } from "vitest";
import { createFactories, MOCK_PASSWORD } from "./factories.js";

describe("factories", () => {
  it("build objects that match the shared-types schemas", () => {
    const f = createFactories("s");
    expect(f.user().email).toMatch(/@mock\.test$/);
    expect(chat.chatSchema.safeParse(f.chat()).success).toBe(true);
    expect(chat.messageSchema.safeParse(f.userMessage()).success).toBe(true);
    expect(chat.messageSchema.safeParse(f.assistantMessage()).success).toBe(true);
    expect(chat.messageSchema.safeParse(f.thinkingMessage()).success).toBe(true);
    expect(chat.messageSchema.safeParse(f.webFetchMessage()).success).toBe(true);
    expect(chat.attachmentSchema.safeParse(f.attachment()).success).toBe(true);
    expect(chat.chatMemberSchema.safeParse(f.member()).success).toBe(true);
  });

  it("gives users a known password for the auth mock", () => {
    expect(createFactories().user().password).toBe(MOCK_PASSWORD);
  });

  it("builds thinking and web fetch messages with their parts", () => {
    const f = createFactories();
    const thinking = f.thinkingMessage();
    expect(thinking.role).toBe("assistant");
    expect(thinking.reasoning).toBeTruthy();
    const fetched = f.webFetchMessage();
    expect(fetched.webFetches?.map((w) => w.status)).toEqual(["done", "error"]);
  });

  it("builds a provider key whose last4 matches the key", () => {
    const key = createFactories().providerKey({ provider: "openai" });
    expect(key.provider).toBe("openai");
    expect(key.apiKey.endsWith(key.last4)).toBe(true);
    expect(key.last4).toHaveLength(4);
  });

  it("applies overrides", () => {
    const f = createFactories();
    expect(f.chat({ title: "Mine", provider: "openai" })).toMatchObject({ title: "Mine", provider: "openai" });
    expect(f.userMessage({ content: "hi", chatId: "c" })).toMatchObject({ content: "hi", chatId: "c", role: "user" });
  });

  it("uses a model that belongs to the chosen provider", () => {
    const f = createFactories();
    expect(f.chat({ provider: "openai" }).model).toMatch(/^gpt/);
    expect(f.chat({ provider: "anthropic" }).model).toMatch(/^claude/);
  });

  it("gives unique ids and increasing dates", () => {
    const f = createFactories();
    const messages = Array.from({ length: 20 }, () => f.message());
    expect(new Set(messages.map((m) => m.id)).size).toBe(20);
    const dates = messages.map((m) => m.createdAt);
    expect([...dates].sort()).toEqual(dates);
  });

  it("is deterministic for a seed and different across seeds", () => {
    const make = (seed: string) => {
      const f = createFactories(seed);
      return [f.user(), f.chat(), f.assistantMessage(), f.attachment()];
    };
    expect(make("a")).toEqual(make("a"));
    expect(make("a")).not.toEqual(make("b"));
  });
});
