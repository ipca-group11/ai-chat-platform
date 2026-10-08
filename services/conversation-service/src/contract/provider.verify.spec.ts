import { mkdtempSync } from "node:fs";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Verifier } from "@pact-foundation/pact";
import { pactFilesFor, splitKnownFailures, type KnownFailure } from "@platform/pact-config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QueueEntry } from "../features/queue/index.js";
import { tokenFor, TEST_SERVICE_TOKEN } from "../test-utils/auth-token.js";
import { buildTestApp, type TestApp } from "../test-utils/build-test-app.js";

// Provider verification of conversation-service (AICHAT-181): the real app (`createApp`)
// with the in-memory fakes replays every interaction of mfe-chat, mfe-settings and
// auth-service. Each provider state builds a fresh app and seeds it with the fixed ids the
// pacts use (chat-1, msg-1). The fake queue's processor never finishes on its own, so a
// submitted reply stays "in progress" until it is stopped.

/** Interactions the provider does not honour yet. Each must still fail; remove an entry
 * once its defect is fixed (the run then says so). */
const KNOWN_FAILURES: KnownFailure[] = [
  { consumer: "mfe-chat", description: "a multipart upload of a text file", issue: "AICHAT-255" },
  { consumer: "mfe-settings", description: "a connection test with a valid key", issue: "AICHAT-256" },
  { consumer: "mfe-settings", description: "a connection test with a rejected key", issue: "AICHAT-256" },
];

/** The user every state signs in as; the JWT's email claim is `user-1@example.com`. */
const USER = "user-1";
const CHAT_ID = "chat-1";
const MESSAGE_ID = "msg-1";

let current: TestApp = buildTestApp();

function fresh(): TestApp {
  current = buildTestApp();
  return current;
}

function seedChat(app: TestApp, ownerId: string = USER): void {
  const now = new Date("2026-10-08T10:00:00.000Z");
  app.chatsRepo.seed({
    id: CHAT_ID,
    ownerId,
    ownerEmail: `${ownerId}@example.com`,
    title: "Trip plan",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    reasoning: false,
    webFetch: false,
    createdAt: now,
    updatedAt: now,
  });
}

function seedMessage(app: TestApp, fields: { role: "user" | "assistant"; status: "sent" | "queued" | "failed" }): void {
  const now = new Date("2026-10-08T10:01:00.000Z");
  app.messagesRepo.seed({
    id: MESSAGE_ID,
    chatId: CHAT_ID,
    ownerId: USER,
    authorEmail: fields.role === "user" ? `${USER}@example.com` : null,
    content: "Hello",
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...fields,
  });
}

/** Starts a reply in chat-1; with the fake processor it runs until stopped. */
function startReply(app: TestApp, messageId = "msg-running"): void {
  const entry: QueueEntry = { messageId, content: "Tell me a story", attachmentIds: [], kind: "send", userId: USER };
  app.queueManager.submit(CHAT_ID, entry);
}

const stateHandlers = {
  // mfe-chat
  "a user is signed in": async () => {
    fresh();
  },
  "the chat does not exist": async () => {
    fresh();
  },
  "a user owns a chat": async () => {
    seedChat(fresh());
  },
  "a user owns a chat with a member": async (params?: unknown) => {
    const app = fresh();
    seedChat(app);
    await app.chatsRepo.addMember({ chatId: CHAT_ID, email: (params as { email: string }).email, invitedBy: USER });
  },
  "a user is a member of a chat": async () => {
    const app = fresh();
    seedChat(app, "owner-2");
    await app.chatsRepo.addMember({ chatId: CHAT_ID, email: `${USER}@example.com`, invitedBy: "owner-2" });
  },
  "a user owns a chat with a message": async () => {
    const app = fresh();
    seedChat(app);
    seedMessage(app, { role: "user", status: "sent" });
  },
  "a user owns a chat with a queued message": async () => {
    const app = fresh();
    seedChat(app);
    startReply(app);
    seedMessage(app, { role: "user", status: "queued" });
    app.queueManager.submit(CHAT_ID, { messageId: MESSAGE_ID, content: "Hello", attachmentIds: [], kind: "send", userId: USER });
  },
  "a user owns a chat with a failed reply": async () => {
    const app = fresh();
    seedChat(app);
    seedMessage(app, { role: "assistant", status: "failed" });
  },
  "a user owns a chat with a reply in progress": async () => {
    const app = fresh();
    seedChat(app);
    startReply(app);
  },
  // auth-service (internal routes)
  "a user has chats": async () => {
    seedChat(fresh());
  },
  "a user has a reply in progress": async () => {
    const app = fresh();
    seedChat(app);
    startReply(app);
  },
  // mfe-settings: the route does not exist yet (AICHAT-256); nothing to prepare.
  "the LLM provider accepts the API key": async () => {
    fresh();
  },
  "the LLM provider rejects the API key": async () => {
    fresh();
  },
};

describe("conversation-service honours its consumers' pacts", () => {
  const split = splitKnownFailures(
    pactFilesFor("conversation-service"),
    KNOWN_FAILURES,
    mkdtempSync(join(tmpdir(), "conversation-pacts-")),
  );
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const forward: RequestListener = (req, res) => current.app(req, res);
    server = createServer(forward);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const verify = (pactUrls: string[]) =>
    new Verifier({
      provider: "conversation-service",
      providerBaseUrl: baseUrl,
      pactUrls,
      stateHandlers,
      // Credentials are not part of the pacts: internal routes get the service token of the
      // test app, every other route the signed-in user's access token.
      requestFilter: (req, _res, next) => {
        if (req.url.startsWith("/internal/")) req.headers["authorization"] = `Bearer ${TEST_SERVICE_TOKEN}`;
        else req.headers["cookie"] = `access_token=${tokenFor(USER)}`;
        next();
      },
      logLevel: "warn",
    }).verifyProvider();

  it("verifies every interaction except the known failures", async () => {
    await verify(split.verify);
  });

  it.each(split.expectedToFail)("still fails $failure.issue: $failure.consumer \"$failure.description\"", async ({ file }) => {
    await expect(verify([file]), "this interaction now passes: remove it from KNOWN_FAILURES").rejects.toThrow();
  });
});
