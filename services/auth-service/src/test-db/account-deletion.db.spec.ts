/**
 * Account deletion across both services, against one real Postgres (AICHAT-130).
 *
 * auth-service runs for real (Prisma, bcrypt, cookies). conversation-service runs for real too, on a
 * local port, with its own schema in the same database and a real upload directory; the two talk over
 * HTTP through the same erasure client the product uses. Nothing is faked except the network failure
 * of the partial-failure case.
 */
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
// eslint-disable-next-line @nx/enforce-module-boundaries -- this test runs conversation-service on purpose
import { createApp as createConversationApp } from "../../../conversation-service/src/app.js";
// eslint-disable-next-line @nx/enforce-module-boundaries -- this test runs conversation-service on purpose
import { PrismaClient as ConversationPrisma } from "../../../conversation-service/src/generated/prisma-client/index.js";
// eslint-disable-next-line @nx/enforce-module-boundaries -- this test runs conversation-service on purpose
import { parseEnv } from "../../../conversation-service/src/shared/env.js";
import { createApp } from "../main.js";
import { PrismaClient } from "../generated/prisma-client/index.js";
import { createErasureClient, type ErasureClient } from "../shared/erasure-client.js";

const PASSWORD = "password1";
const SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN as string;
const conversationServiceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../conversation-service");

const auth = new PrismaClient();
let conversation: ConversationPrisma;
let conversationServer: Server;
let conversationUrl: string;
let uploadDir: string;

/** The conversation-service schema lives next to the auth one, like in compose (one instance, one schema per service). */
function conversationDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL as string);
  url.searchParams.set("schema", "conversation");
  return url.toString();
}

beforeAll(async () => {
  execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    cwd: conversationServiceDir,
    env: { ...process.env, DATABASE_URL: conversationDatabaseUrl() },
    stdio: "ignore",
  });
  conversation = new ConversationPrisma({ datasourceUrl: conversationDatabaseUrl() });
  uploadDir = await mkdtemp(path.join(tmpdir(), "account-deletion-db-"));
  const app = createConversationApp(
    conversation as never,
    parseEnv({ JWT_SECRET: process.env.JWT_SECRET, UPLOAD_DIR: uploadDir, INTERNAL_SERVICE_TOKEN: SERVICE_TOKEN, LOG_LEVEL: "silent" }),
  );
  conversationServer = createServer(app);
  await new Promise<void>((resolve) => conversationServer.listen(0, "127.0.0.1", resolve));
  conversationUrl = `http://127.0.0.1:${(conversationServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => conversationServer.close(resolve));
  await conversation.$disconnect();
  await auth.$disconnect();
  await rm(uploadDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await auth.user.deleteMany();
  await conversation.chat.deleteMany();
  for (const name of await readdir(uploadDir)) await rm(path.join(uploadDir, name), { force: true });
});

const realErasure = () => createErasureClient({ baseUrl: conversationUrl, token: SERVICE_TOKEN });
const authApp = (erasure: ErasureClient = realErasure()) => createApp({ prisma: auth, erasure });
const exists = (file: string) => access(file).then(() => true, () => false);

interface Person {
  id: string;
  email: string;
  cookie: string[];
}

async function signUp(app: ReturnType<typeof authApp>, email: string): Promise<Person> {
  const registered = await request(app).post("/auth/register").send({ email, password: PASSWORD }).expect(201);
  const login = await request(app).post("/auth/login").send({ email, password: PASSWORD }).expect(200);
  const cookie = (login.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0] as string);
  return { id: (registered.body as { id: string }).id, email, cookie };
}

/** A chat created through the conversation API. */
async function createChat(owner: Person, title: string, invite?: Person): Promise<string> {
  const res = await request(conversationUrl).post("/chats").set("Cookie", owner.cookie).send({ title, provider: "openai", model: "gpt-4o" }).expect(201);
  const id = (res.body as { chat: { id: string } }).chat.id;
  if (invite) await request(conversationUrl).post(`/chats/${id}/members`).set("Cookie", owner.cookie).send({ email: invite.email }).expect(201);
  return id;
}

/** A message written by `author` in the chat, with one uploaded file (through the API, so the file really lands on disk). */
async function postFile(author: Person, chatId: string, name: string): Promise<{ messageId: string; storagePath: string }> {
  const message = await conversation.message.create({ data: { chatId, ownerId: author.id, authorEmail: author.email, role: "user", content: `from ${name}` } });
  await request(conversationUrl)
    .post(`/chats/${chatId}/messages/${message.id}/attachments`)
    .set("Cookie", author.cookie)
    .attach("file", Buffer.from(`contents of ${name}`), { filename: `${name}.txt`, contentType: "text/plain" })
    .expect(201);
  const attachment = await conversation.attachment.findFirstOrThrow({ where: { messageId: message.id } });
  return { messageId: message.id, storagePath: attachment.storagePath };
}

/** Ana and Ben share chats both ways; each has a message with a file in each chat, and one has an assistant reply. */
async function seedSharedChats() {
  const app = authApp();
  const ana = await signUp(app, "ana@example.test");
  const ben = await signUp(app, "ben@example.test");
  const anaChat = await createChat(ana, "Ana's chat", ben);
  const benChat = await createChat(ben, "Ben's chat", ana);
  const files = {
    anaInAnaChat: (await postFile(ana, anaChat, "ana-in-ana-chat")).storagePath,
    benInAnaChat: (await postFile(ben, anaChat, "ben-in-ana-chat")).storagePath,
    anaInBenChat: (await postFile(ana, benChat, "ana-in-ben-chat")).storagePath,
    benInBenChat: (await postFile(ben, benChat, "ben-in-ben-chat")).storagePath,
  };
  await conversation.message.create({ data: { chatId: benChat, ownerId: ben.id, role: "assistant", content: "assistant reply" } });
  return { app, ana, ben, anaChat, benChat, files };
}

describe("DELETE /auth/me against a real database", () => {
  it("erases the chats, messages, attachment rows and files, the memberships and the refresh tokens of the user", async () => {
    const { app, ana, ben, anaChat, benChat, files } = await seedSharedChats();
    expect(await auth.refreshToken.count({ where: { userId: ana.id } })).toBe(1);
    expect(await conversation.attachment.count()).toBe(4);

    const res = await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    // auth-service: the user and the refresh tokens are gone, the other user is untouched.
    expect(await auth.user.findUnique({ where: { id: ana.id } })).toBeNull();
    expect(await auth.refreshToken.count({ where: { userId: ana.id } })).toBe(0);
    expect(await auth.user.findUnique({ where: { id: ben.id } })).not.toBeNull();
    expect(await auth.refreshToken.count({ where: { userId: ben.id } })).toBe(1);
    // conversation-service: the chat Ana owned is gone for everyone, with its messages, members and files.
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).toBeNull();
    expect(await conversation.message.count({ where: { chatId: anaChat } })).toBe(0);
    expect(await conversation.attachment.count({ where: { storagePath: { in: [files.anaInAnaChat, files.benInAnaChat] } } })).toBe(0);
    expect(await exists(files.anaInAnaChat)).toBe(false);
    expect(await exists(files.benInAnaChat)).toBe(false);
    // Shared chat Ben owns: Ana's membership, message, attachment row and file are gone; Ben's data stays.
    expect(await conversation.chatMember.count({ where: { chatId: benChat, email: ana.email } })).toBe(0);
    expect(await conversation.message.count({ where: { chatId: benChat, ownerId: ana.id } })).toBe(0);
    expect(await conversation.attachment.count({ where: { storagePath: files.anaInBenChat } })).toBe(0);
    expect(await exists(files.anaInBenChat)).toBe(false);
    expect(await conversation.chat.findUnique({ where: { id: benChat } })).not.toBeNull();
    expect(await conversation.message.count({ where: { chatId: benChat } })).toBe(2); // Ben's message and the assistant reply
    expect(await exists(files.benInBenChat)).toBe(true);
    expect(await readdir(uploadDir)).toHaveLength(1);
    // Nothing in either database references Ana any more.
    expect(await conversation.message.count({ where: { OR: [{ ownerId: ana.id }, { authorEmail: ana.email }] } })).toBe(0);
    expect(await conversation.chat.count({ where: { OR: [{ ownerId: ana.id }, { ownerEmail: ana.email }] } })).toBe(0);
    expect(await conversation.chatMember.count({ where: { email: ana.email } })).toBe(0);
    expect(await conversation.attachment.count({ where: { ownerId: ana.id } })).toBe(0);
  });

  it("keeps the account when conversation-service cannot be reached, and a retry succeeds", async () => {
    const { ana, anaChat, files } = await seedSharedChats();
    const unreachable = createErasureClient({ baseUrl: conversationUrl, token: SERVICE_TOKEN, fetchImpl: () => Promise.reject(new Error("connect ECONNREFUSED")) });

    const failed = await request(authApp(unreachable)).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD });

    expect(failed.status).toBe(502);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).not.toBeNull();
    expect(await auth.refreshToken.count({ where: { userId: ana.id } })).toBe(1);
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).not.toBeNull();
    expect(await exists(files.anaInAnaChat)).toBe(true);

    const retried = await request(authApp()).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD });

    expect(retried.status).toBe(204);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).toBeNull();
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).toBeNull();
    expect(await exists(files.anaInAnaChat)).toBe(false);
  });

  it("keeps the account when conversation-service answers with an error, and a retry succeeds", async () => {
    const { ana, anaChat } = await seedSharedChats();
    const wrongToken = createErasureClient({ baseUrl: conversationUrl, token: "x".repeat(40) }); // refused with 401

    const failed = await request(authApp(wrongToken)).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD });

    expect(failed.status).toBe(502);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).not.toBeNull();
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).not.toBeNull();

    await request(authApp()).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD }).expect(204);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).toBeNull();
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).toBeNull();
  });

  it("finishes after the conversation data was erased but the user row delete failed", async () => {
    const { ana, anaChat } = await seedSharedChats();
    // The first user delete fails, as if the database dropped the connection after the erasure.
    let failures = 1;
    const flaky = new Proxy(auth, {
      get(target, property, receiver) {
        if (property === "user") {
          return new Proxy(target.user, {
            get(user, method, userReceiver) {
              if (method === "deleteMany" && failures-- > 0) return () => Promise.reject(new Error("connection lost"));
              return Reflect.get(user, method, userReceiver) as unknown;
            },
          });
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const app = createApp({ prisma: flaky, erasure: realErasure() });

    const failed = await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD });

    expect(failed.status).toBe(502);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).not.toBeNull();
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).toBeNull(); // already erased

    await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD }).expect(204);
    expect(await auth.user.findUnique({ where: { id: ana.id } })).toBeNull();
  });

  it("is idempotent: repeating the request after the account is gone still answers 204", async () => {
    const { app, ana } = await seedSharedChats();
    await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD }).expect(204);

    await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: PASSWORD }).expect(204);
  });

  it("refuses a wrong password and deletes nothing", async () => {
    const { app, ana, anaChat } = await seedSharedChats();

    await request(app).delete("/auth/me").set("Cookie", ana.cookie).send({ password: "not-the-password1" }).expect(401);

    expect(await auth.user.findUnique({ where: { id: ana.id } })).not.toBeNull();
    expect(await conversation.chat.findUnique({ where: { id: anaChat } })).not.toBeNull();
  });
});
