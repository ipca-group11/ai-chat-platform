import { describe, expect, it, vi } from "vitest";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { ChatsService } from "../chats/index.js";
import { QueueManager } from "../queue/index.js";
import { ChatEventBus } from "../streaming/index.js";
import { MessagesService } from "./service.js";
import { HttpError } from "../../shared/error-handler.js";
import { asUser } from "../../test-utils/principal.js";

function neverResolves() {
  return new Promise<void>(() => {});
}

async function setup(processor: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(neverResolves())) {
  const chatsRepo = new FakeChatsRepository();
  const chatsService = new ChatsService(chatsRepo);
  const messagesRepo = new FakeMessagesRepository();
  const queueManager = new QueueManager(processor);
  const bus = new ChatEventBus();
  const service = new MessagesService(messagesRepo, chatsService, queueManager, bus);
  const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
  return { chatsService, messagesRepo, queueManager, bus, service, chat };
}

describe("MessagesService", () => {
  it("AC-51: a sent text message is persisted immediately", async () => {
    const { service, chat, messagesRepo } = await setup();
    const message = await service.send(asUser("user-1"), chat.id, { content: "hi", attachmentIds: [] });
    expect(message.content).toBe("hi");
    expect(messagesRepo.has(message.id)).toBe(true);
  });

  it("AC-56/57: a message sent while the chat is busy is queued", async () => {
    const { service, chat } = await setup();
    const first = await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });
    expect(first.status).toBe("sent");

    const second = await service.send(asUser("user-1"), chat.id, { content: "second", attachmentIds: [] });
    expect(second.status).toBe("queued");
  });

  it("AC-45/46: sending to another user's chat is rejected", async () => {
    const { service, chat } = await setup();
    await expect(service.send(asUser("intruder"), chat.id, { content: "hi", attachmentIds: [] })).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("AC-58: a queued message can be edited before processing starts", async () => {
    const { service, chat, messagesRepo } = await setup();
    await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });
    const second = await service.send(asUser("user-1"), chat.id, { content: "original", attachmentIds: [] });

    const edited = await service.editQueued(asUser("user-1"), chat.id, second.id, "edited");
    expect(edited.content).toBe("edited");
    expect(messagesRepo.all().find((m) => m.id === second.id)?.content).toBe("edited");
  });

  it("AC-58: editing a message that is already being processed is rejected", async () => {
    const { service, chat } = await setup();
    const first = await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });

    await expect(service.editQueued(asUser("user-1"), chat.id, first.id, "edited")).rejects.toBeInstanceOf(HttpError);
  });

  it("AC-58: a queued message can be canceled before processing starts", async () => {
    const { service, chat, messagesRepo } = await setup();
    await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });
    const second = await service.send(asUser("user-1"), chat.id, { content: "second", attachmentIds: [] });

    await service.cancelQueued(asUser("user-1"), chat.id, second.id);
    expect(messagesRepo.has(second.id)).toBe(false);
  });

  it("AC-54: stop delegates to the queue manager and reports whether anything was stopped", async () => {
    const { service, chat } = await setup();
    await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });

    const result = await service.stop(asUser("user-1"), chat.id);
    expect(result.stopped).toBe(true);
  });

  it("AC-73: retry resets a failed assistant message and resubmits it to the queue", async () => {
    const { service, chat, messagesRepo } = await setup();
    const failed = await messagesRepo.create({
      chatId: chat.id,
      ownerId: "user-1",
      role: "assistant",
      content: "partial",
      status: "failed",
    });

    const retried = await service.retry(asUser("user-1"), chat.id, failed.id);
    expect(retried.status).toBe("queued");
  });

  it("AC-73: retrying a message that did not fail is rejected", async () => {
    const { service, chat, messagesRepo } = await setup();
    const sent = await messagesRepo.create({
      chatId: chat.id,
      ownerId: "user-1",
      role: "assistant",
      content: "done",
      status: "sent",
    });

    await expect(service.retry(asUser("user-1"), chat.id, sent.id)).rejects.toBeInstanceOf(HttpError);
  });

  it("AC-43/55: list returns the full persisted chat history", async () => {
    const { service, chat } = await setup();
    await service.send(asUser("user-1"), chat.id, { content: "hi", attachmentIds: [] });

    const messages = await service.list(asUser("user-1"), chat.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("hi");
  });

  describe("shared chats", () => {
    async function setupShared() {
      const ctx = await setup();
      await ctx.chatsService.addMember(asUser("user-1"), ctx.chat.id, "guest@example.com");
      return ctx;
    }

    it("a member can send a message, recorded under their own identity", async () => {
      const { service, chat } = await setupShared();
      const message = await service.send(asUser("guest"), chat.id, { content: "hi from guest", attachmentIds: [] });
      expect(message).toMatchObject({ authorId: "guest", authorEmail: "guest@example.com" });

      const history = await service.list(asUser("user-1"), chat.id);
      expect(history.map((m) => m.content)).toEqual(["hi from guest"]);
    });

    it("sending publishes a message event so other members see it live", async () => {
      const { service, chat, bus } = await setupShared();
      const events: unknown[] = [];
      bus.subscribe(chat.id, (event) => events.push(event));

      const message = await service.send(asUser("guest"), chat.id, { content: "hello", attachmentIds: [] });

      expect(events).toContainEqual({ type: "message", message });
    });

    it("a member cannot edit or cancel someone else's queued message", async () => {
      const { service, chat } = await setupShared();
      await service.send(asUser("user-1"), chat.id, { content: "first", attachmentIds: [] });
      const queued = await service.send(asUser("user-1"), chat.id, { content: "owner's", attachmentIds: [] });

      await expect(service.editQueued(asUser("guest"), chat.id, queued.id, "hijacked")).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(service.cancelQueued(asUser("guest"), chat.id, queued.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("a member can retry a failed assistant reply", async () => {
      const { service, chat, messagesRepo } = await setupShared();
      const failed = await messagesRepo.create({
        chatId: chat.id,
        ownerId: "user-1",
        role: "assistant",
        content: "",
        status: "failed",
      });

      const retried = await service.retry(asUser("guest"), chat.id, failed.id);
      expect(retried.status).toBe("queued");
    });
  });
});
