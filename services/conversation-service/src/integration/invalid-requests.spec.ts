/**
 * AICHAT-186: invalid requests are refused with 400 and the error envelope, never a 500. Each row
 * is one bad request; `field` is the key expected in `fieldErrors`. Every response is also checked
 * against the OpenAPI route table (documented status, envelope, correlation id).
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor, TEST_SERVICE_TOKEN } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { createResponseChecker } from "../test-utils/documented-response.js";

const { expectDocumentedResponse } = createResponseChecker();
const owner = cookieFor("owner");
const BAD_PARAM = "%E0%A4%A"; // a truncated UTF-8 sequence: the path cannot be decoded

type App = ReturnType<typeof buildTestApp>["app"];
type Method = "get" | "post" | "patch" | "delete";

interface Case {
  route: string;
  name: string;
  method: Method;
  /** The URL, built from the ids of a seeded chat and message. */
  path: (ids: { chatId: string; messageId: string }) => string;
  /** A JSON body, or a raw string sent as `application/json`. */
  body?: object | string;
  service?: boolean;
  code?: string;
  field?: string;
  status?: number;
}

const chat = { title: "T", provider: "openai", model: "gpt-4o" };
const long = (n: number) => "x".repeat(n);

const CASES: Case[] = [
  // POST /chats
  { route: "POST /chats", name: "missing field", method: "post", path: () => "/chats", body: { provider: "openai", model: "m" }, field: "title" },
  { route: "POST /chats", name: "wrong type", method: "post", path: () => "/chats", body: { ...chat, reasoning: "yes" }, field: "reasoning" },
  { route: "POST /chats", name: "value not allowed", method: "post", path: () => "/chats", body: { ...chat, provider: "gemini" }, field: "provider" },
  { route: "POST /chats", name: "too long", method: "post", path: () => "/chats", body: { ...chat, title: long(201) }, field: "title" },
  { route: "POST /chats", name: "extra field", method: "post", path: () => "/chats", body: { ...chat, ownerId: "someone-else" }, field: "ownerId" },
  { route: "POST /chats", name: "malformed JSON", method: "post", path: () => "/chats", body: '{"title":', code: "INVALID_JSON" },
  { route: "POST /chats", name: "body over the 100 kB limit", method: "post", path: () => "/chats", body: { ...chat, title: long(110_000) }, code: "PAYLOAD_TOO_LARGE", status: 413 },
  // /chats/:id
  { route: "GET /chats/:id", name: "bad path param", method: "get", path: () => `/chats/${BAD_PARAM}`, code: "BAD_REQUEST" },
  { route: "PATCH /chats/:id", name: "empty body", method: "patch", path: ({ chatId }) => `/chats/${chatId}`, body: {}, field: "_" },
  { route: "PATCH /chats/:id", name: "wrong type", method: "patch", path: ({ chatId }) => `/chats/${chatId}`, body: { webFetch: 1 }, field: "webFetch" },
  { route: "PATCH /chats/:id", name: "extra field", method: "patch", path: ({ chatId }) => `/chats/${chatId}`, body: { title: "x", ownerId: "me" }, field: "ownerId" },
  { route: "PATCH /chats/:id", name: "bad path param", method: "patch", path: () => `/chats/${BAD_PARAM}`, body: { title: "x" }, code: "BAD_REQUEST" },
  { route: "DELETE /chats/:id", name: "bad path param", method: "delete", path: () => `/chats/${BAD_PARAM}`, code: "BAD_REQUEST" },
  // members
  { route: "POST /chats/:id/members", name: "missing field", method: "post", path: ({ chatId }) => `/chats/${chatId}/members`, body: {}, field: "email" },
  { route: "POST /chats/:id/members", name: "not an email", method: "post", path: ({ chatId }) => `/chats/${chatId}/members`, body: { email: "nope" }, field: "email" },
  { route: "POST /chats/:id/members", name: "extra field", method: "post", path: ({ chatId }) => `/chats/${chatId}/members`, body: { email: "a@example.com", role: "owner" }, field: "role" },
  { route: "DELETE /chats/:id/members/:email", name: "bad path param", method: "delete", path: ({ chatId }) => `/chats/${chatId}/members/${BAD_PARAM}`, code: "BAD_REQUEST" },
  // messages
  { route: "POST /chats/:chatId/messages", name: "missing field", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: {}, field: "content" },
  { route: "POST /chats/:chatId/messages", name: "only spaces", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: { content: "   " }, field: "content" },
  { route: "POST /chats/:chatId/messages", name: "too long", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: { content: long(32_001) }, field: "content" },
  { route: "POST /chats/:chatId/messages", name: "wrong type", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: { content: "hi", attachmentIds: "a1" }, field: "attachmentIds" },
  { route: "POST /chats/:chatId/messages", name: "too many items", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: { content: "hi", attachmentIds: Array.from({ length: 11 }, (_, i) => `a${i}`) }, field: "attachmentIds" },
  { route: "POST /chats/:chatId/messages", name: "extra field", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: { content: "hi", role: "assistant" }, field: "role" },
  { route: "POST /chats/:chatId/messages", name: "malformed JSON", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages`, body: "not json", code: "INVALID_JSON" },
  { route: "GET /chats/:chatId/messages", name: "bad path param", method: "get", path: () => `/chats/${BAD_PARAM}/messages`, code: "BAD_REQUEST" },
  { route: "PATCH /chats/:chatId/messages/:messageId", name: "too long", method: "patch", path: ({ chatId, messageId }) => `/chats/${chatId}/messages/${messageId}`, body: { content: long(32_001) }, field: "content" },
  { route: "PATCH /chats/:chatId/messages/:messageId", name: "extra field", method: "patch", path: ({ chatId, messageId }) => `/chats/${chatId}/messages/${messageId}`, body: { content: "x", status: "sent" }, field: "status" },
  { route: "DELETE /chats/:chatId/messages/:messageId", name: "bad path param", method: "delete", path: ({ chatId }) => `/chats/${chatId}/messages/${BAD_PARAM}`, code: "BAD_REQUEST" },
  { route: "POST /chats/:chatId/messages/:messageId/retry", name: "bad path param", method: "post", path: ({ chatId }) => `/chats/${chatId}/messages/${BAD_PARAM}/retry`, code: "BAD_REQUEST" },
  { route: "POST /chats/:chatId/stop", name: "bad path param", method: "post", path: () => `/chats/${BAD_PARAM}/stop`, code: "BAD_REQUEST" },
  { route: "GET /chats/:chatId/stream", name: "bad path param", method: "get", path: () => `/chats/${BAD_PARAM}/stream`, code: "BAD_REQUEST" },
  // internal
  { route: "POST /internal/erasures", name: "missing field", method: "post", path: () => "/internal/erasures", body: { userId: "u-1" }, service: true, field: "email" },
  { route: "POST /internal/erasures", name: "too long", method: "post", path: () => "/internal/erasures", body: { userId: long(129), email: "u@example.com" }, service: true, field: "userId" },
  { route: "POST /internal/erasures", name: "extra field", method: "post", path: () => "/internal/erasures", body: { userId: "u-1", email: "u@example.com", all: true }, service: true, field: "all" },
  { route: "POST /internal/sessions/:userId/stop", name: "bad path param", method: "post", path: () => `/internal/sessions/${BAD_PARAM}/stop`, service: true, code: "BAD_REQUEST" },
];

async function seeded(): Promise<{ app: App; chatId: string; messageId: string }> {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "owner");
  await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).send({ content: "first" });
  const queued = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).send({ content: "second" });
  return { app: t.app, chatId, messageId: queued.body.message.id as string };
}

function send(app: App, c: Case, ids: { chatId: string; messageId: string }) {
  let req = request(app)[c.method](c.path(ids));
  req = c.service ? req.set("Authorization", `Bearer ${TEST_SERVICE_TOKEN}`) : req.set("Cookie", owner);
  if (typeof c.body === "string") return req.set("Content-Type", "application/json").send(c.body);
  return c.body ? req.send(c.body) : req;
}

describe("invalid requests are refused with 400 and field errors, never 500", () => {
  it.each(CASES.map((c) => [`${c.route} · ${c.name}`, c] as const))("%s", async (_title, c) => {
    const { app, chatId, messageId } = await seeded();
    const res = await send(app, c, { chatId, messageId });

    expect(res.status, JSON.stringify(res.body)).toBe(c.status ?? 400);
    expect(res.body.error.code).toBe(c.code ?? "VALIDATION_ERROR");
    if (c.field) expect(Object.keys(res.body.error.fieldErrors ?? {})).toContain(c.field);
    expectDocumentedResponse(c.route, res);
  });
});

describe("attachment upload: type and size are checked before anything is stored", () => {
  async function upload(options: { maxUploadBytes?: number }, file?: { body: Buffer; filename: string; contentType: string }) {
    const t = buildTestApp(options);
    const chatId = await createChatVia(t.app, "owner");
    const message = await t.messagesRepo.create({ chatId, ownerId: "owner", authorEmail: "owner@example.com", role: "user", content: "hi", status: "sent" });
    const req = request(t.app).post(`/chats/${chatId}/messages/${message.id}/attachments`).set("Cookie", owner);
    const res = await (file ? req.attach("file", file.body, { filename: file.filename, contentType: file.contentType }) : req);
    expectDocumentedResponse("POST /chats/:chatId/messages/:messageId/attachments", res);
    expect(t.attachmentsRepo.all()).toHaveLength(0);
    return res;
  }

  it.each([
    ["a type that is not allowed", { body: Buffer.from("MZ"), filename: "tool.exe", contentType: "application/x-msdownload" }, "ATTACHMENT_TYPE_NOT_ALLOWED"],
    ["a MIME type that does not match the extension", { body: Buffer.from("hi"), filename: "notes.txt", contentType: "image/png" }, "ATTACHMENT_TYPE_NOT_ALLOWED"],
  ] as const)("400 for %s", async (_name, file, code) => {
    const res = await upload({}, file);
    expect([res.status, res.body.error.code]).toEqual([400, code]);
  });

  it("400 ATTACHMENT_TOO_LARGE for a file over MAX_UPLOAD_BYTES", async () => {
    const res = await upload({ maxUploadBytes: 10 }, { body: Buffer.alloc(15, 97), filename: "notes.txt", contentType: "text/plain" });
    expect([res.status, res.body.error.code]).toEqual([400, "ATTACHMENT_TOO_LARGE"]);
  });

  it("400 ATTACHMENT_UPLOAD_ERROR for a file over twice the limit (refused while it is read)", async () => {
    const res = await upload({ maxUploadBytes: 10 }, { body: Buffer.alloc(50, 97), filename: "notes.txt", contentType: "text/plain" });
    expect([res.status, res.body.error.code]).toEqual([400, "ATTACHMENT_UPLOAD_ERROR"]);
  });

  // Found by Schemathesis (AICHAT-187): a multipart part without headers made the parser throw a plain
  // Error ("Malformed part header"), which became a 500.
  it("400 ATTACHMENT_UPLOAD_ERROR for a multipart body that cannot be parsed", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "owner");
    const message = await t.messagesRepo.create({ chatId, ownerId: "owner", authorEmail: "owner@example.com", role: "user", content: "hi", status: "sent" });
    const boundary = "7c5156fb04a2177cf9e322ad31ebde44";
    const res = await request(t.app)
      .post(`/chats/${chatId}/messages/${message.id}/attachments`)
      .set("Cookie", owner)
      .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
      .send(`--${boundary}\r\nNone--${boundary}--\r\n`);
    expect([res.status, res.body.error.code]).toEqual([400, "ATTACHMENT_UPLOAD_ERROR"]);
    expectDocumentedResponse("POST /chats/:chatId/messages/:messageId/attachments", res);
  });

  it("400 ATTACHMENT_REQUIRED without a file", async () => {
    const res = await upload({});
    expect([res.status, res.body.error.code]).toEqual([400, "ATTACHMENT_REQUIRED"]);
  });
});
