/**
 * AICHAT-94 (and AICHAT-112): drive every route of conversation-service with planted fake
 * PII and prove none of it reaches the logs. The logger writes to memory; the assertions
 * use the shared detector from `@platform/pii-detector`.
 */
import { createLogCapture, describePii, findPiiInLines } from "@platform/pii-detector";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "../shared/logger.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";
import { throwingRepository } from "../test-utils/throwing-repository.js";
import type { ChatsRepository } from "../features/chats/service.js";

const CANARY = "PII-CANARY-7f3a";
const GUEST_EMAIL = "guest.canary@pii-canary.example.com";
const BODY_TEXT = `${CANARY} secret message body`;
const FILE_NAME = `${CANARY}-report.txt`;
const FILE_TEXT = `${CANARY} text inside the attachment`;
const API_KEY = "sk-ant-api03-CanaryKey1234567890";
const CLIENT_IP = "203.0.113.77";
const canaries = [CANARY, GUEST_EMAIL, API_KEY];

function capturedApp(extra: Parameters<typeof buildTestApp>[0] = {}) {
  const logs = createLogCapture();
  const t = buildTestApp({ ...extra, logger: createLogger("debug", logs) });
  return { ...t, logs };
}

function expectNoPii(logs: ReturnType<typeof createLogCapture>) {
  expect(logs.lines().length).toBeGreaterThan(0); // the test must have produced log lines
  expect(describePii(findPiiInLines(logs.lines(), { canaries }))).toBe("");
}

describe("conversation-service logs carry no PII", () => {
  it("stay clean across every route, success and failure", async () => {
    const t = capturedApp();
    const owner = cookieFor("user-1");
    const headers = { "X-Llm-Api-Key": API_KEY, "X-Forwarded-For": CLIENT_IP, "X-Correlation-Id": "corr-1" };
    const as = (cookie: string[]) => ({ Cookie: cookie, ...headers });

    await request(t.app).get("/health");
    await request(t.app).get("/metrics");
    await request(t.app).get(`/nope/${GUEST_EMAIL}?token=${API_KEY}`).set(as(owner));

    const chatId = await createChatVia(t.app, "user-1", { title: `${CANARY} title` });
    await request(t.app).get("/chats").set(as(owner));
    await request(t.app).get("/chats").set(headers); // 401
    await request(t.app).get(`/chats/${chatId}`).set(as(owner));
    await request(t.app).patch(`/chats/${chatId}`).set(as(owner)).send({ title: `${CANARY} renamed` });
    await request(t.app).patch(`/chats/${chatId}`).set(as(owner)).send({ title: "" }); // 400
    await inviteVia(t.app, "user-1", chatId, GUEST_EMAIL);
    await request(t.app).get(`/chats/${chatId}/members`).set(as(owner));
    await request(t.app).delete(`/chats/${chatId}/members/${encodeURIComponent(GUEST_EMAIL)}`).set(as(owner));
    await request(t.app).delete(`/chats/${chatId}/membership`).set(as(cookieFor("guest")));

    const sent = await request(t.app).post(`/chats/${chatId}/messages`).set(as(owner)).send({ content: BODY_TEXT });
    const queued = await request(t.app).post(`/chats/${chatId}/messages`).set(as(owner)).send({ content: `${BODY_TEXT} 2` });
    const messageId = queued.body.message.id as string;
    await request(t.app).post(`/chats/${chatId}/messages`).set(as(owner)).send({ content: 12345, note: BODY_TEXT }); // 400
    await request(t.app).get(`/chats/${chatId}/messages`).set(as(owner));
    await request(t.app).patch(`/chats/${chatId}/messages/${messageId}`).set(as(owner)).send({ content: `${BODY_TEXT} edited` });
    await request(t.app).post(`/chats/${chatId}/stop`).set(as(owner));
    const failed = await t.messagesRepo.create({ chatId, ownerId: "user-1", role: "assistant", content: BODY_TEXT, status: "failed" });
    await request(t.app).post(`/chats/${chatId}/messages/${failed.id}/retry`).set(as(owner));
    await request(t.app).delete(`/chats/${chatId}/messages/${messageId}`).set(as(owner));
    await request(t.app).get(`/chats/${chatId}/stream`).set(headers); // 401

    const upload = `/chats/${chatId}/messages/${sent.body.message.id as string}/attachments`;
    await request(t.app).post(upload).set(as(owner)).attach("file", Buffer.from(FILE_TEXT), { filename: FILE_NAME, contentType: "text/plain" });
    await request(t.app).post(upload).set(as(owner)).attach("file", Buffer.from(FILE_TEXT), { filename: `${FILE_NAME}.exe`, contentType: "application/x-msdownload" });
    await request(t.app).post(upload).set(as(owner)).attach("wrong-field", Buffer.from(FILE_TEXT), { filename: FILE_NAME });

    await request(t.app).post(`/chats/${chatId}/messages`).set(as(owner)).set("Content-Type", "application/json").send(`{"content": "${BODY_TEXT}`); // malformed JSON
    await request(t.app).delete(`/chats/${chatId}`).set(as(owner));

    expectNoPii(t.logs);
  });

  it("stay clean when an unexpected error mentions an email and an address", async () => {
    const error = new Error(`insert failed for ${GUEST_EMAIL} from ${CLIENT_IP}`);
    const t = capturedApp({ overrides: { chatsRepo: throwingRepository<ChatsRepository>(error) } });
    const res = await request(t.app).get("/chats").set("Cookie", cookieFor("user-1"));
    expect(res.status).toBe(500);
    expectNoPii(t.logs);
  });
});
