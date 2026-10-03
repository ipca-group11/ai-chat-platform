import { describe, expect, it } from "vitest";
import type { Message } from "../../../shared/types";
import { selectQueuedMessages } from "./select-queued";

function makeMessage(id: string, status: Message["status"]): Message {
  return {
    id,
    chatId: "chat-1",
    role: "user",
    content: `content-${id}`,
    attachments: [],
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("selectQueuedMessages (AC-56, AC-57)", () => {
  it("AC-56/AC-57: returns only messages currently in the queued state", () => {
    const messages = [
      makeMessage("1", "sent"),
      makeMessage("2", "queued"),
      makeMessage("3", "streaming"),
      makeMessage("4", "queued"),
      makeMessage("5", "failed"),
    ];

    expect(selectQueuedMessages(messages).map((m) => m.id)).toEqual(["2", "4"]);
  });

  it("returns an empty array when nothing is queued", () => {
    expect(selectQueuedMessages([makeMessage("1", "sent")])).toEqual([]);
  });
});
