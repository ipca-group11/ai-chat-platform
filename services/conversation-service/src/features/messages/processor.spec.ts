import { describe, expect, it } from "vitest";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { ChatsService } from "../chats/index.js";
import {
  ProviderError,
  type ProviderRegistry,
  type LlmProvider,
  type LlmStreamChunk,
  type SendMessageContext,
  type SendMessageOptions,
} from "../llm-adapters/index.js";
import { ChatEventBus } from "../streaming/index.js";
import { createMessageProcessor } from "./processor.js";
import type { SseEvent } from "../../shared/contracts/chat.js";
import { asUser } from "../../test-utils/principal.js";

class ScriptedProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  constructor(private readonly script: (context: SendMessageContext, options?: SendMessageOptions) => AsyncIterable<LlmStreamChunk>) {}
  sendMessage(context: SendMessageContext, options?: SendMessageOptions): AsyncIterable<LlmStreamChunk> {
    return this.script(context, options);
  }
  supportsVision(): boolean {
    return false;
  }
  supportsReasoning(): boolean {
    return false;
  }
  supportsWebFetch(): boolean {
    return false;
  }
}

function registryOf(provider: LlmProvider): ProviderRegistry {
  return { get: () => provider };
}

async function collectEvents(bus: ChatEventBus, chatId: string, run: () => Promise<void>): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  const unsubscribe = bus.subscribe(chatId, (e) => events.push(e));
  await run();
  unsubscribe();
  return events;
}

async function setupChatWithUserMessage() {
  const chatsRepo = new FakeChatsRepository();
  const chatsService = new ChatsService(chatsRepo);
  const messagesRepo = new FakeMessagesRepository();
  const bus = new ChatEventBus();
  const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
  const userMessage = await messagesRepo.create({
    chatId: chat.id,
    ownerId: "user-1",
    role: "user",
    content: "hello",
    status: "queued",
  });
  return { chatsService, messagesRepo, bus, chat, userMessage };
}

describe("createMessageProcessor", () => {
  it("AC-52/53: streams tokens and sends the full conversation history as context", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    let capturedContext: string[] = [];
    const provider = new ScriptedProvider(async function* (context) {
      capturedContext = context.messages.map((m) => m.content);
      yield "Hel";
      yield "lo";
    });
    const processor = createMessageProcessor({
      messagesRepo,
      chatsService,
      providerRegistry: registryOf(provider),
      bus,
    });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal),
    );

    expect(capturedContext).toEqual(["hello"]);
    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.map((e) => (e as { token: string }).token)).toEqual(["Hel", "lo"]);
    expect(events.some((e) => e.type === "done")).toBe(true);

    const assistantMessages = messagesRepo.all().filter((m) => m.role === "assistant");
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.content).toBe("Hello");
    expect(assistantMessages[0]?.status).toBe("sent");
  });

  it("passes the chat's reasoning toggle to the provider", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    await chatsService.update("user-1", chat.id, { reasoning: true });
    let reasoning: boolean | undefined;
    const provider = new ScriptedProvider(async function* (context) {
      reasoning = context.reasoning;
      yield "ok";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    await processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal);

    expect(reasoning).toBe(true);
  });

  it("streams and saves the model's reasoning when the chat has reasoning on", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    await chatsService.update("user-1", chat.id, { reasoning: true });
    const provider = new ScriptedProvider(async function* () {
      yield { type: "reasoning", text: "Think" };
      yield { type: "reasoning", text: "ing" };
      yield "Answer";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal),
    );

    expect(events.filter((e) => e.type === "reasoning").map((e) => (e as { token: string }).token)).toEqual(["Think", "ing"]);
    const assistant = messagesRepo.all().find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Answer");
    expect(assistant?.reasoning).toBe("Thinking");
  });

  it("drops reasoning a model produces while the chat has reasoning off", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const provider = new ScriptedProvider(async function* () {
      yield { type: "reasoning", text: "hidden" };
      yield "Answer";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal),
    );

    expect(events.some((e) => e.type === "reasoning")).toBe(false);
    expect(messagesRepo.all().find((m) => m.role === "assistant")?.reasoning).toBeNull();
  });

  it("passes the chat's web fetch toggle to the provider", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    await chatsService.update("user-1", chat.id, { webFetch: true });
    let webFetch: boolean | undefined;
    const provider = new ScriptedProvider(async function* (context) {
      webFetch = context.webFetch;
      yield "ok";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    await processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal);

    expect(webFetch).toBe(true);
  });

  it("streams web fetch progress and saves the finished fetches with the reply", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const provider = new ScriptedProvider(async function* () {
      yield { type: "web_fetch", id: "f1", url: "https://example.com", status: "fetching" };
      yield { type: "web_fetch", id: "f1", url: "https://example.com", status: "done", title: "Example" };
      yield "Summary";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal),
    );

    expect(events.filter((e) => e.type === "web_fetch").map((e) => (e as { fetch: { status: string } }).fetch.status)).toEqual([
      "fetching",
      "done",
    ]);
    const assistant = messagesRepo.all().find((m) => m.role === "assistant");
    expect(assistant?.webFetches).toEqual([{ id: "f1", url: "https://example.com", status: "done", title: "Example" }]);
  });

  it("doesn't save a fetch that was still running when the reply was stopped", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const controller = new AbortController();
    const provider = new ScriptedProvider(async function* () {
      yield { type: "web_fetch", id: "f1", url: "https://example.com", status: "fetching" };
      controller.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    await processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, controller.signal);

    expect(messagesRepo.all().find((m) => m.role === "assistant")?.webFetches).toBeNull();
  });

  it("AC-55: the completed response is saved so it reappears after reload", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const provider = new ScriptedProvider(async function* () {
      yield "answer";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    await processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal);

    const persisted = await messagesRepo.findByChatOrdered(chat.id);
    const assistant = persisted.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("answer");
    expect(assistant?.status).toBe("sent");
  });

  it("AC-54: stopping mid-stream saves the partial response", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const controller = new AbortController();
    const provider = new ScriptedProvider(async function* (_context, options) {
      yield "partial-";
      controller.abort();
      if (options?.signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      yield "never-sent";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, controller.signal),
    );

    const assistant = messagesRepo.all().find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("partial-");
    expect(assistant?.status).toBe("sent");
    const doneEvent = events.find((e) => e.type === "done") as { stopped?: boolean } | undefined;
    expect(doneEvent?.stopped).toBe(true);
  });

  it("AC-72/74: a provider error is caught, surfaced, and marks the message failed without throwing", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const provider = new ScriptedProvider(async function* () {
      throw new ProviderError("anthropic", "rate limited", { retryable: true });
      yield "";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    const events = await collectEvents(bus, chat.id, () =>
      processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal),
    );

    const assistant = messagesRepo.all().find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("failed");
    expect(assistant?.error).toBe("rate limited");
    const errorEvent = events.find((e) => e.type === "error") as { retryable?: boolean } | undefined;
    expect(errorEvent?.retryable).toBe(true);
  });

  it("AC-50: subsequent messages use the chat's persisted provider and model, even after it changes", async () => {
    const { chatsService, messagesRepo, bus, chat, userMessage } = await setupChatWithUserMessage();
    const seenRequests: Array<{ providerId: string; model: string }> = [];
    const anthropicProvider = new ScriptedProvider(async function* (context) {
      seenRequests.push({ providerId: "anthropic", model: context.model });
      yield "first";
    });
    const openaiProvider: LlmProvider = {
      id: "openai",
      supportsVision: () => false,
      supportsReasoning: () => false,
      supportsWebFetch: () => false,
      sendMessage: async function* (context: SendMessageContext) {
        seenRequests.push({ providerId: "openai", model: context.model });
        yield "second";
      },
    };
    const registry: ProviderRegistry = {
      get: (providerId) => (providerId === "openai" ? openaiProvider : anthropicProvider),
    };
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registry, bus });

    // First message uses the provider/model the chat was created with.
    await processor(chat.id, { messageId: userMessage.id, content: "hello", attachmentIds: [] }, new AbortController().signal);

    // Editing the chat persists a new provider/model (AC-49); a later message must pick
    // up that new configuration rather than reusing what the first request used.
    await chatsService.update("user-1", chat.id, { provider: "openai", model: "gpt-4o" });
    const secondUserMessage = await messagesRepo.create({
      chatId: chat.id,
      ownerId: "user-1",
      role: "user",
      content: "again",
      status: "queued",
    });

    await processor(chat.id, { messageId: secondUserMessage.id, content: "again", attachmentIds: [] }, new AbortController().signal);

    expect(seenRequests).toEqual([
      { providerId: "anthropic", model: "claude-haiku-4-5" },
      { providerId: "openai", model: "gpt-4o" },
    ]);
  });

  it("AC-73: a retry entry reprocesses the existing failed assistant message in place", async () => {
    const { chatsService, messagesRepo, bus, chat } = await setupChatWithUserMessage();
    const failed = await messagesRepo.create({
      chatId: chat.id,
      ownerId: "user-1",
      role: "assistant",
      content: "",
      status: "failed",
    });
    const provider = new ScriptedProvider(async function* () {
      yield "recovered";
    });
    const processor = createMessageProcessor({ messagesRepo, chatsService, providerRegistry: registryOf(provider), bus });

    await processor(chat.id, { messageId: failed.id, content: "", attachmentIds: [], kind: "retry" }, new AbortController().signal);

    const updated = await messagesRepo.findById(failed.id);
    expect(updated?.content).toBe("recovered");
    expect(updated?.status).toBe("sent");
    expect(messagesRepo.all().filter((m) => m.role === "assistant")).toHaveLength(1);
  });
});
