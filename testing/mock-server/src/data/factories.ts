import type { chat } from "@app/shared-types";
import { createRng, type Rng } from "../prng.js";
import type { MockMember, MockProviderKey, MockUser } from "./types.js";

// Password of the seeded mock users; test data only, never a real account (AICHAT-27 WAIVERS.md W11)
// nosemgrep: node_password
export const MOCK_PASSWORD = "Mock-pass-1234";

const SENTENCES = [
  "Here is a short summary of what you asked.",
  "Streaming responses arrive token by token.",
  "Let me break this down into three steps.",
  "The result depends on the provider and the model.",
  "You can attach a file and ask about its content.",
  "That works, and here is a small example.",
  "Both options are valid; the second is simpler to test.",
  "I checked the page and found the relevant section.",
];
const TITLES = ["Trip planning", "Refactor ideas", "Release notes", "Budget review", "Reading list", "Bug triage"];
const MODELS = {
  anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5"],
  openai: ["gpt-4o-mini", "gpt-4.1"],
  ollama: ["llama3.2:1b"],
} as const;
const FILE_TYPES: Array<{ mimeType: chat.AttachmentMimeType; ext: string }> = [
  { mimeType: "text/plain", ext: "txt" },
  { mimeType: "application/pdf", ext: "pdf" },
  { mimeType: "image/png", ext: "png" },
  { mimeType: "image/jpeg", ext: "jpg" },
];

/** Overrides accepted by every factory: any field of the built object. */
export type Overrides<T> = Partial<T>;

export interface Factories {
  readonly rng: Rng;
  user(overrides?: Overrides<MockUser>): MockUser;
  chat(overrides?: Overrides<chat.Chat>): chat.Chat;
  /** A member of `chatId`; the owner row has role `owner`. */
  member(overrides?: Overrides<MockMember>): MockMember;
  /** A user message by default. */
  message(overrides?: Overrides<chat.Message>): chat.Message;
  userMessage(overrides?: Overrides<chat.Message>): chat.Message;
  assistantMessage(overrides?: Overrides<chat.Message>): chat.Message;
  /** Assistant answer with the model's reasoning text. */
  thinkingMessage(overrides?: Overrides<chat.Message>): chat.Message;
  /** Assistant answer that fetched web pages (one done, one failed). */
  webFetchMessage(overrides?: Overrides<chat.Message>): chat.Message;
  attachment(overrides?: Overrides<chat.Attachment>): chat.Attachment;
  providerKey(overrides?: Overrides<MockProviderKey>): MockProviderKey;
}

const START = Date.parse("2026-01-01T09:00:00.000Z");

/**
 * Builds the factories. The same `seed` always builds the same objects (ids, text and
 * dates), so a test can assert on them. Plain TypeScript with no server code: import it
 * from Vitest or Playwright through `@platform/mock-server`.
 */
export function createFactories(seed: string | number = 1): Factories {
  const rng = createRng(seed);
  const counters = new Map<string, number>();
  let tick = 0;

  const nextId = (kind: string): string => {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    return `${kind}_${String(n).padStart(5, "0")}`;
  };
  /** Each call is one minute later than the previous, so ordering by date matches creation order. */
  const nextDate = (): string => new Date(START + tick++ * 60_000).toISOString();

  const message = (overrides: Overrides<chat.Message> = {}): chat.Message => ({
    id: nextId("msg"),
    chatId: "chat_00001",
    role: "user",
    content: rng.pick(SENTENCES),
    status: "complete",
    attachmentIds: [],
    createdAt: nextDate(),
    ...overrides,
  });
  const assistantMessage = (overrides: Overrides<chat.Message> = {}) =>
    message({ role: "assistant", content: `${rng.pick(SENTENCES)} ${rng.pick(SENTENCES)}`, ...overrides });

  return {
    rng,
    user(overrides = {}) {
      const id = nextId("user");
      return {
        id,
        email: `${id.replace("_", "")}@mock.test`,
        password: MOCK_PASSWORD,
        createdAt: nextDate(),
        ...overrides,
      };
    },
    chat(overrides = {}) {
      const provider = overrides.provider ?? rng.pick(["anthropic", "openai"] as const);
      const createdAt = nextDate();
      return {
        id: nextId("chat"),
        ownerId: "user_00001",
        title: `${rng.pick(TITLES)} ${rng.int(1, 999)}`,
        provider,
        model: rng.pick(MODELS[provider]),
        reasoning: false,
        webFetch: false,
        createdAt,
        updatedAt: createdAt,
        ...overrides,
      };
    },
    member(overrides = {}) {
      return {
        chatId: "chat_00001",
        email: "user00001@mock.test",
        role: "member",
        addedAt: nextDate(),
        ...overrides,
      };
    },
    message,
    userMessage: (overrides = {}) => message({ role: "user", ...overrides }),
    assistantMessage,
    thinkingMessage: (overrides = {}) =>
      assistantMessage({
        reasoning: `First, ${rng.pick(SENTENCES).toLowerCase()} Then compare the options and pick one.`,
        ...overrides,
      }),
    webFetchMessage: (overrides = {}) =>
      assistantMessage({
        webFetches: [
          { id: nextId("fetch"), url: "https://example.com/docs", status: "done", title: "Example docs" },
          { id: nextId("fetch"), url: "https://example.com/private", status: "error", errorCode: "url_not_accessible" },
        ],
        ...overrides,
      }),
    attachment(overrides = {}) {
      const type = rng.pick(FILE_TYPES);
      const id = nextId("att");
      const originalFilename = `${id}.${type.ext}`;
      return {
        id,
        messageId: "msg_00001",
        ownerId: "user_00001",
        originalFilename,
        storedPath: `uploads/${originalFilename}`,
        mimeType: type.mimeType,
        size: rng.int(1_000, 500_000),
        extractedTextStatus: type.mimeType === "image/png" || type.mimeType === "image/jpeg" ? "not_applicable" : "extracted",
        createdAt: nextDate(),
        ...overrides,
      };
    },
    providerKey(overrides = {}) {
      const apiKey = `mock-key-${rng.int(100000, 999999)}${rng.int(1000, 9999)}`;
      return {
        userId: "user_00001",
        provider: "anthropic",
        apiKey,
        last4: apiKey.slice(-4),
        createdAt: nextDate(),
        ...overrides,
      };
    },
  };
}
