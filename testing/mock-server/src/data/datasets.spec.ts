import { chat } from "@app/shared-types";
import { describe, expect, it } from "vitest";
import {
  buildDataset,
  countRecords,
  DATASET_NAMES,
  isDatasetName,
  LONG_CONVERSATION_MESSAGES,
  MANY_CHATS_COUNT,
} from "./datasets.js";

describe("datasets", () => {
  it("lists the six named datasets", () => {
    expect([...DATASET_NAMES]).toEqual([
      "empty",
      "default",
      "many-chats",
      "long-conversation",
      "shared-chats",
      "attachments",
    ]);
    expect(isDatasetName("default")).toBe(true);
    expect(isDatasetName("nope")).toBe(false);
  });

  it("empty has no records", () => {
    expect(Object.values(countRecords(buildDataset("empty"))).every((n) => n === 0)).toBe(true);
  });

  it("default has users, chats with thinking and web fetch messages, and provider keys", () => {
    const data = buildDataset("default");
    expect(data.users.length).toBeGreaterThanOrEqual(2);
    expect(data.chats.length).toBeGreaterThanOrEqual(3);
    expect(data.messages.some((m) => m.reasoning)).toBe(true);
    expect(data.messages.some((m) => (m.webFetches?.length ?? 0) > 0)).toBe(true);
    expect(data.providerKeys.length).toBeGreaterThan(0);
  });

  it("many-chats has more than 200 chats for one user", () => {
    const data = buildDataset("many-chats");
    expect(data.chats).toHaveLength(MANY_CHATS_COUNT);
    expect(data.chats.length).toBeGreaterThan(200);
    expect(new Set(data.chats.map((c) => c.ownerId)).size).toBe(1);
  });

  it("long-conversation has one chat with 500 messages", () => {
    const data = buildDataset("long-conversation");
    expect(data.chats).toHaveLength(1);
    expect(data.messages).toHaveLength(LONG_CONVERSATION_MESSAGES);
    expect(data.messages.every((m) => m.chatId === data.chats[0]?.id)).toBe(true);
  });

  it("shared-chats has chats with several members", () => {
    const data = buildDataset("shared-chats");
    const shared = data.chats.filter((c) => data.members.filter((m) => m.chatId === c.id).length > 2);
    expect(shared.length).toBeGreaterThanOrEqual(3);
    const roles = data.members.filter((m) => m.chatId === shared[0]?.id).map((m) => m.role);
    expect(roles.filter((r) => r === "owner")).toHaveLength(1);
  });

  it("attachments has one file of every allowed type, each linked to a message", () => {
    const data = buildDataset("attachments");
    expect(new Set(data.attachments.map((a) => a.mimeType))).toEqual(new Set(chat.attachmentMimeTypeSchema.options));
    for (const file of data.attachments) {
      const message = data.messages.find((m) => m.id === file.messageId);
      expect(message?.attachmentIds).toContain(file.id);
    }
  });

  it.each(DATASET_NAMES)("%s only holds records that match the shared-types schemas", (name) => {
    const data = buildDataset(name);
    for (const c of data.chats) expect(chat.chatSchema.safeParse(c).success).toBe(true);
    for (const m of data.messages) expect(chat.messageSchema.safeParse(m).success).toBe(true);
    for (const a of data.attachments) expect(chat.attachmentSchema.safeParse(a).success).toBe(true);
    for (const m of data.members) expect(chat.chatMemberSchema.safeParse(m).success).toBe(true);
  });

  it("builds the same records for the same seed", () => {
    expect(buildDataset("default", "x")).toEqual(buildDataset("default", "x"));
    expect(buildDataset("default", "x")).not.toEqual(buildDataset("default", "y"));
  });

  it("rejects an unknown dataset and names the available ones", () => {
    expect(() => buildDataset("nope")).toThrow(/Unknown dataset "nope".*empty, default/);
  });
});
