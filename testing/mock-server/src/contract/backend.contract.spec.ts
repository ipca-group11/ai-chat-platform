import { get, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { auth, chat, http } from "@app/shared-types";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z, type ZodType } from "zod";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { MOCK_PASSWORD } from "../data/factories.js";
import {
  attachmentDtoSchema,
  chatDtoSchema,
  chatMemberDtoSchema,
  messageDtoSchema,
  sseEventSchema,
} from "../conversation/contract.js";

/**
 * Contract test for the backend mocks. Every kind of response is checked twice.
 *
 * 1. Against the schemas of the real services (`src/conversation/contract.ts`, the auth shapes
 *    of auth-service): the mock must match them exactly, with no missing and no extra field.
 * 2. Against `@platform/shared-types`: the mock follows the real service, so where the two
 *    differ the difference is listed in DRIFT below. The list is exact: a new difference fails
 *    the test, and so does a difference that was fixed but is still listed. Fix the drift in
 *    shared-types (AICHAT-20) or, if the service changed, update contract.ts and the list.
 */

/** Paths (numbers replaced by `[]`) where a value differs from a schema, and how. */
type Diff = string;

const pathOf = (path: ReadonlyArray<PropertyKey>): string =>
  path.map((part) => (typeof part === "number" ? "[]" : String(part))).join(".").replaceAll(".[]", "[]") || "(body)";

/** Fields present in `value` that the schema does not declare. */
function extraFields(schema: ZodType, value: unknown, path: PropertyKey[] = []): Diff[] {
  const def = (schema as unknown as { def: Record<string, unknown> }).def;
  const type = def.type as string;
  if (type === "optional" || type === "nullable" || type === "default" || type === "readonly") {
    return value === null || value === undefined ? [] : extraFields(def.innerType as ZodType, value, path);
  }
  if (type === "array" && Array.isArray(value)) {
    return value.flatMap((item, index) => extraFields(def.element as ZodType, item, [...path, index]));
  }
  if (type === "union") {
    const options = def.options as ZodType[];
    const match = options.find((option) => option.safeParse(value).success) ?? options.find((option) => {
      const discriminator = def.discriminator as string | undefined;
      const shape = (option as unknown as { shape?: Record<string, ZodType> }).shape;
      return (
        discriminator !== undefined &&
        shape?.[discriminator]?.safeParse((value as Record<string, unknown>)[discriminator]).success === true
      );
    });
    return match ? extraFields(match, value, path) : [];
  }
  if (type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const shape = (schema as unknown as { shape: Record<string, ZodType> }).shape;
    const own = Object.keys(value).filter((key) => !(key in shape)).map((key) => `extra ${pathOf([...path, key])}`);
    const nested = Object.entries(shape).flatMap(([key, child]) =>
      key in value ? extraFields(child, (value as Record<string, unknown>)[key], [...path, key]) : [],
    );
    return [...own, ...nested];
  }
  return [];
}

/** How a value differs from a schema: failed checks and fields the schema does not know. */
function differences(schema: ZodType, value: unknown): Diff[] {
  const result = schema.safeParse(value);
  const failed = result.success ? [] : result.error.issues.map((issue) => `${pathOf(issue.path)}: ${issue.code}`);
  return [...new Set([...failed, ...extraFields(schema, value)])].sort();
}

// --- the responses -------------------------------------------------------------------------
interface Sample {
  /** What the response is, as named in DRIFT. */
  kind: string;
  value: unknown;
}
const samples: Sample[] = [];
const record = (kind: string, value: unknown) => samples.push({ kind, value });

const sseSamples = new Map<string, unknown>();

async function readStream(port: number, cookie: string, chatId: string, until: () => boolean): Promise<void> {
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    get({ port, path: `/api/chats/${chatId}/stream`, headers: { Cookie: cookie } }, resolve).on("error", reject);
  });
  let buffer = "";
  response.setEncoding("utf8");
  response.on("data", (chunk: string) => {
    buffer += chunk;
    for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
      const data = /^data: (.*)$/m.exec(buffer.slice(0, end))?.[1];
      buffer = buffer.slice(end + 2);
      if (!data) continue;
      const event = JSON.parse(data) as { type: string };
      if (!sseSamples.has(event.type)) sseSamples.set(event.type, event);
    }
  });
  for (let i = 0; i < 500 && !until(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  response.destroy();
}

let server: ReturnType<ReturnType<typeof createApp>["app"]["listen"]>;

beforeAll(async () => {
  const { app } = createApp(
    loadConfig({ MOCK_DATASET: "attachments", TTFT_MS: "0", TOKEN_INTERVAL_MS: "5", TOKENS: "6" }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const api = request(`http://127.0.0.1:${port}`);

  // auth-service
  const register = await api.post("/auth/register").send({ email: "contract@mock.test", password: "Contract-pass-1" });
  record("auth.register", register.body);
  const login = await api.post("/auth/login").send({ email: "alice@mock.test", password: MOCK_PASSWORD });
  record("auth.login", login.body);
  const cookie = (login.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
  record("auth.me", (await api.get("/auth/me").set("Cookie", cookie)).body);
  record("error", (await api.post("/auth/login").send({ email: "alice@mock.test", password: "wrong" })).body);
  const as = (method: "get" | "post" | "patch" | "delete", path: string) => api[method](`/api${path}`).set("Cookie", cookie);

  // conversation-service: chats
  const created = await as("post", "/chats").send({
    title: "Contract",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    reasoning: true,
    webFetch: true,
  });
  record("chat", created.body.chat);
  const chatId = created.body.chat.id as string;
  for (const item of (await as("get", "/chats")).body.chats as unknown[]) record("chat", item);
  record("chat", (await as("get", `/chats/${chatId}`)).body.chat);
  record("chat", (await as("patch", `/chats/${chatId}`).send({ title: "Renamed" })).body.chat);
  record("error", (await as("get", "/chats/chat_missing")).body);
  record("error", (await as("post", "/chats").send({ title: "" })).body);

  // members
  await as("post", `/chats/${chatId}/members`).send({ email: "bob@mock.test" });
  for (const member of (await as("get", `/chats/${chatId}/members`)).body.members as unknown[]) record("member", member);

  // messages and the stream, in the order a client sees them
  const events = readStream(port, cookie, chatId, () => ["done", "error"].every((type) => sseSamples.has(type)));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const first = await as("post", `/chats/${chatId}/messages`).send({ content: "first" });
  record("message", first.body.message);
  // Sent while the first answer streams: queued.
  const second = await as("post", `/chats/${chatId}/messages`).set("X-Mock-Scenario", "error").send({ content: "second" });
  record("message", second.body.message);
  await events;
  for (let i = 0; i < 300; i++) {
    const { messages } = (await as("get", `/chats/${chatId}/messages`)).body as { messages: Array<{ status: string }> };
    if (messages.every((m) => m.status !== "streaming" && m.status !== "queued")) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  for (const message of (await as("get", `/chats/${chatId}/messages`)).body.messages as unknown[]) record("message", message);
  const history = (await as("get", `/chats/${chatId}/messages`)).body.messages as Array<{ id: string; status: string }>;
  const failed = history.find((m) => m.status === "failed");
  if (failed) record("message", (await as("post", `/chats/${chatId}/messages/${failed.id}/retry`)).body.message);

  // attachments
  const file = Buffer.from(
    '--XX\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--XX--\r\n',
  );
  const upload = await as("post", `/chats/${chatId}/attachments`)
    .set("Content-Type", "multipart/form-data; boundary=XX")
    .send(file);
  record("attachment", upload.body.attachment);
  const seeded = (await as("get", "/chats")).body.chats as Array<{ id: string; title: string }>;
  const files = seeded.find((c) => c.title === "Files");
  if (files) {
    const seededMessages = (await as("get", `/chats/${files.id}/messages`)).body.messages as Array<{ attachments: unknown[] }>;
    for (const message of seededMessages) for (const attachment of message.attachments) record("attachment", attachment);
  }
}, 30_000);

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const realService: Record<string, ZodType> = {
  "auth.register": z.object({ id: z.string(), email: z.string() }),
  "auth.login": z.object({ id: z.string(), email: z.string() }),
  "auth.me": z.object({ id: z.string(), email: z.string() }),
  chat: chatDtoSchema,
  member: chatMemberDtoSchema,
  message: messageDtoSchema,
  attachment: attachmentDtoSchema,
  error: http.errorResponseSchema,
};

const sharedTypes: Record<string, ZodType> = {
  "auth.register": auth.authResponseSchema,
  "auth.login": auth.authResponseSchema,
  "auth.me": auth.authResponseSchema,
  chat: chat.chatSchema,
  member: chat.chatMemberSchema,
  message: chat.messageSchema,
  attachment: chat.attachmentSchema,
  error: http.errorResponseSchema,
};

/**
 * Known drift of `@platform/shared-types` from the services, per kind of response, as found
 * when this test was written. Recorded as a finding for AICHAT-20 (snapshot testing).
 */
const DRIFT: Record<string, Diff[]> = {
  "auth.register": ["user: invalid_type", "extra email", "extra id"],
  "auth.login": ["user: invalid_type", "extra email", "extra id"],
  "auth.me": ["user: invalid_type", "extra email", "extra id"],
  chat: ["extra ownerEmail"],
  // The services answer with the stored record; shared-types describes an earlier shape.
  member: [],
  message: ["extra attachments", "extra authorEmail", "extra authorId", "extra error", "extra truncated", "status: invalid_value"],
  attachment: [
    "extra filename",
    "extra kind",
    "extractedTextStatus: invalid_value",
    "originalFilename: invalid_type",
    "ownerId: invalid_type",
    "storedPath: invalid_type",
  ],
  error: [],
};

/** Stream events of the service that shared-types does not describe, or describes differently.
 * Empty since AICHAT-221: shared-types describes the events the service sends. */
const STREAM_DRIFT: Record<string, Diff[]> = {
  message: [],
  queued: [],
  started: [],
  token: [],
  reasoning: [],
  web_fetch: [],
  done: [],
  error: [],
};

describe("backend mock responses", () => {
  it("collected a sample of every kind of response", () => {
    const kinds = new Set(samples.map((s) => s.kind));
    for (const kind of Object.keys(realService)) expect(kinds.has(kind), `no sample of "${kind}"`).toBe(true);
    for (const type of ["message", "queued", "started", "token", "reasoning", "web_fetch", "done", "error"]) {
      expect(sseSamples.has(type), `no "${type}" stream event`).toBe(true);
    }
  });

  it("match the schemas of the real services, with no missing and no extra field", () => {
    for (const { kind, value } of samples) {
      expect(differences(realService[kind] as ZodType, value), `${kind}: ${JSON.stringify(value)}`).toEqual([]);
    }
    for (const [type, event] of sseSamples) {
      expect(differences(sseEventSchema, event), `stream event ${type}`).toEqual([]);
    }
  });

  it("differ from @platform/shared-types only where DRIFT says so", () => {
    const found: Record<string, Diff[]> = {};
    for (const kind of Object.keys(sharedTypes)) {
      const diffs = new Set<Diff>();
      for (const sample of samples.filter((s) => s.kind === kind)) {
        for (const diff of differences(sharedTypes[kind] as ZodType, sample.value)) diffs.add(diff);
      }
      found[kind] = [...diffs].sort();
    }
    expect(found).toEqual(Object.fromEntries(Object.keys(sharedTypes).map((kind) => [kind, [...(DRIFT[kind] ?? [])].sort()])));
  });

  it("send stream events that differ from the shared-types events only where STREAM_DRIFT says so", () => {
    const found: Record<string, Diff[]> = {};
    for (const [type, event] of sseSamples) found[type] = differences(chat.sseEventSchema, event);
    expect(found).toEqual(STREAM_DRIFT);
  });
});

describe("what shared-types accepts as a request", () => {
  it("is accepted by the mock", async () => {
    const { app } = createApp(loadConfig({ MOCK_DATASET: "default", TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "4" }));
    const login = await request(app).post("/auth/login").send({ email: "alice@mock.test", password: MOCK_PASSWORD });
    const cookie = (login.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
    const as = (method: "post" | "patch", path: string) => request(app)[method](`/api${path}`).set("Cookie", cookie);

    const createBody = chat.createChatRequestSchema.parse({ title: "Valid", provider: "openai", model: "gpt-4o" });
    const created = await as("post", "/chats").send(createBody);
    expect(created.status).toBe(201);
    const id = created.body.chat.id as string;
    expect((await as("patch", `/chats/${id}`).send(chat.updateChatRequestSchema.parse({ title: "Renamed" }))).status).toBe(200);
    expect(
      (await as("post", `/chats/${id}/members`).send(chat.addChatMemberRequestSchema.parse({ email: "bob@mock.test" }))).status,
    ).toBeLessThan(300);
    const sent = await as("post", `/chats/${id}/messages`).send(chat.sendMessageRequestSchema.parse({ content: "hi" }));
    expect(sent.status).toBe(201);
    expect(
      (await request(app).post("/auth/register").send(auth.registerRequestSchema.parse({ email: "new@mock.test", password: "Valid-pass-123" }))).status,
    ).toBe(201);
    expect(
      (await request(app).delete("/auth/me").set("Cookie", cookie).send(auth.deleteAccountRequestSchema.parse({ password: MOCK_PASSWORD }))).status,
    ).toBe(204);
  });
});
