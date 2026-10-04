import { describe, expect, it } from "vitest";
import { toAttachmentDto, toChatDto, toMessageDto } from "./dto";
import { fixtures } from "./fixtures";

describe("toAttachmentDto", () => {
  it.each([
    ["text/plain", "text"],
    ["application/pdf", "pdf"],
    ["image/png", "image"],
    ["image/jpeg", "image"],
  ] as const)("maps %s to the kind %s", (mimeType, kind) => {
    const dto = toAttachmentDto({ ...fixtures.attachment, mimeType });

    expect(dto).toMatchObject({ kind, filename: fixtures.attachment.originalFilename, mimeType });
  });
});

describe("toChatDto", () => {
  it("adds the owner email", () => {
    expect(toChatDto(fixtures.chat)).toMatchObject({ id: fixtures.chat.id, ownerEmail: fixtures.user.email });
    expect(toChatDto(fixtures.chat, "other@example.test").ownerEmail).toBe("other@example.test");
  });
});

describe("toMessageDto", () => {
  it.each([
    ["complete", "sent"],
    ["queued", "queued"],
    ["streaming", "streaming"],
    ["failed", "failed"],
    ["canceled", "failed"],
  ] as const)("maps the stored status %s to %s", (stored, expected) => {
    expect(toMessageDto({ ...fixtures.assistantMessage, status: stored }).status).toBe(expected);
  });

  it("gives a failed message an error text and leaves the others without one", () => {
    expect(toMessageDto({ ...fixtures.assistantMessage, status: "failed" }).error).toMatch(/provider/i);
    expect(toMessageDto(fixtures.assistantMessage).error).toBeNull();
  });

  it("shows the author email only on user messages", () => {
    expect(toMessageDto(fixtures.userMessage).authorEmail).toBe(fixtures.user.email);
    expect(toMessageDto(fixtures.assistantMessage).authorEmail).toBeNull();
  });

  it("defaults reasoning and web fetches, and embeds the attachments", () => {
    const dto = toMessageDto(fixtures.userMessage, [fixtures.attachment]);

    expect(dto).toMatchObject({ reasoning: null, webFetches: [] });
    expect(dto.attachments).toHaveLength(1);
  });

  it("keeps the reasoning and web fetches of a message that has them", () => {
    const thinking = fixtures.factories.thinkingMessage({ chatId: fixtures.chat.id });
    const fetched = fixtures.factories.webFetchMessage({ chatId: fixtures.chat.id });

    expect(toMessageDto(thinking).reasoning).toBe(thinking.reasoning);
    expect(toMessageDto(fetched).webFetches).toHaveLength(2);
  });
});
