import { get, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { chat, http } from "@app/shared-types";
import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { MOCK_PASSWORD } from "../data/factories.js";
import {
  chatDtoSchema,
  chatMemberDtoSchema,
  messageDtoSchema,
  sseEventSchema,
  type MessageDto,
  type SseEvent,
} from "../conversation/contract.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(env: NodeJS.ProcessEnv = {}) {
  const { app, ctx } = createApp(
    loadConfig({ MOCK_DATASET: "default", TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "6", ...env }),
  );
  return { app, ctx };
}

/** Signs in and returns a client with the session cookie on every call. */
async function signIn(app: Express, email = "alice@mock.test") {
  const login = await request(app).post("/auth/login").send({ email, password: MOCK_PASSWORD });
  const cookie = (login.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
  const as = (method: "get" | "post" | "patch" | "delete", path: string) =>
    request(app)[method](`/api${path}`).set("Cookie", cookie);
  return { cookie, as };
}

async function firstChatId(as: Awaited<ReturnType<typeof signIn>>["as"], title = "Welcome") {
  const list = await as("get", "/chats");
  return (list.body.chats as Array<{ id: string; title: string }>).find((c) => c.title === title)?.id as string;
}

/** Waits until nothing is streaming or queued in a chat. */
async function settled(as: Awaited<ReturnType<typeof signIn>>["as"], chatId: string): Promise<MessageDto[]> {
  for (let i = 0; i < 200; i++) {
    const { messages } = (await as("get", `/chats/${chatId}/messages`)).body as { messages: MessageDto[] };
    if (messages.every((m) => m.status !== "streaming" && m.status !== "queued")) return messages;
    await wait(10);
  }
  throw new Error("chat did not settle");
}

/** Opens the SSE stream of a chat on a real socket and collects its events. */
async function openStream(app: Express, cookie: string, chatId: string) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const events: SseEvent[] = [];
  const raw: string[] = [];
  let ended = false;
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    get({ port, path: `/api/chats/${chatId}/stream`, headers: { Cookie: cookie } }, resolve).on("error", reject);
  });
  let buffer = "";
  response.setEncoding("utf8");
  response.on("data", (chunk: string) => {
    buffer += chunk;
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      raw.push(block);
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (data) events.push(sseEventSchema.parse(JSON.parse(data)));
      end = buffer.indexOf("\n\n");
    }
  });
  response.on("close", () => {
    ended = true;
  });
  return {
    response,
    events,
    raw,
    get ended() {
      return ended;
    },
    async until(predicate: (events: SseEvent[]) => boolean) {
      for (let i = 0; i < 300 && !predicate(events); i++) await wait(10);
      return events;
    },
    close() {
      response.destroy();
      server.closeAllConnections();
      server.close();
    },
  };
}

describe("authentication", () => {
  it("answers 401 UNAUTHENTICATED without a session", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/chats");
    expect(res.status).toBe(401);
    expect(http.errorResponseSchema.parse(res.body).error).toEqual({
      code: "UNAUTHENTICATED",
      message: "Missing or invalid access token",
    });
  });

  it("accepts the session of the auth mock", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    expect((await as("get", "/chats")).status).toBe(200);
  });
});

describe("chats", () => {
  it("lists the chats of the user, newest update first, with the shared Chat shape", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const res = await as("get", "/chats");
    expect(res.status).toBe(200);
    const chats = z.array(chatDtoSchema).parse(res.body.chats);
    expect(chats.map((c) => c.title).sort()).toEqual(["Reasoning example", "Web fetch example", "Welcome"]);
    for (const dto of chats) expect(chat.chatSchema.parse(dto).ownerId).toBe(dto.ownerId);
    expect(chats.every((c) => c.ownerEmail === "alice@mock.test")).toBe(true);
  });

  it("creates, reads, renames and deletes a chat", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const created = await as("post", "/chats").send({ title: "  Plans ", provider: "openai", model: "gpt-4o-mini" });
    expect(created.status).toBe(201);
    const dto = chatDtoSchema.parse(created.body.chat);
    expect(chat.chatSchema.parse(dto)).toMatchObject({ title: "Plans", reasoning: false, webFetch: false });

    expect((await as("get", `/chats/${dto.id}`)).body.chat).toEqual(dto);
    const renamed = await as("patch", `/chats/${dto.id}`).send({ title: "Renamed", reasoning: true });
    expect(renamed.body.chat).toMatchObject({ title: "Renamed", reasoning: true });
    expect((await as("delete", `/chats/${dto.id}`)).status).toBe(204);
    expect((await as("get", `/chats/${dto.id}`)).status).toBe(404);
  });

  it("answers VALIDATION_ERROR with field errors for a bad body", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const res = await as("post", "/chats").send({ title: "", provider: "gemini" });
    expect(res.status).toBe(400);
    const body = http.errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fieldErrors ?? {}).sort()).toEqual(["model", "provider", "title"]);
    expect((await as("patch", "/chats/chat_00001").send({})).status).toBe(400);
  });

  it("hides the chats of other users behind 404 CHAT_NOT_FOUND", async () => {
    const { app } = setup();
    const { as } = await signIn(app, "bob@mock.test");
    const alices = await signIn(app);
    const id = await firstChatId(alices.as);
    const res = await as("get", `/chats/${id}`);
    expect(res.status).toBe(404);
    expect(http.errorResponseSchema.parse(res.body).error.code).toBe("CHAT_NOT_FOUND");
    expect((await as("patch", `/chats/${id}`).send({ title: "x" })).status).toBe(404);
    expect((await as("delete", `/chats/${id}`)).status).toBe(404);
  });
});

describe("members (shared-chats dataset)", () => {
  const sharedSetup = () => setup({ MOCK_DATASET: "shared-chats" });

  it("lists the owner first and then the invited members", async () => {
    const { app } = sharedSetup();
    const { as } = await signIn(app);
    const id = await firstChatId(as, "Team plan");
    const res = await as("get", `/chats/${id}/members`);
    const members = z.array(chatMemberDtoSchema).parse(res.body.members);
    expect(members.map((m) => [m.email, m.role])).toEqual([
      ["alice@mock.test", "owner"],
      ["bob@mock.test", "member"],
      ["carol@mock.test", "member"],
      ["dave@mock.test", "member"],
    ]);
    for (const member of members) chat.chatMemberSchema.parse(member);
  });

  it("lets the owner invite and remove, and rejects the usual mistakes", async () => {
    const { app } = sharedSetup();
    const { as } = await signIn(app);
    const id = await firstChatId(as, "Private notes");

    const added = await as("post", `/chats/${id}/members`).send({ email: "Bob@Mock.test" });
    expect(added.status).toBe(201);
    expect(chatMemberDtoSchema.parse(added.body.member)).toMatchObject({ email: "bob@mock.test", role: "member" });
    expect((await as("post", `/chats/${id}/members`).send({ email: "bob@mock.test" })).body.error.code).toBe(
      "ALREADY_A_MEMBER",
    );
    expect((await as("post", `/chats/${id}/members`).send({ email: "alice@mock.test" })).body.error.code).toBe(
      "CANNOT_INVITE_SELF",
    );
    expect((await as("post", `/chats/${id}/members`).send({ email: "nope" })).status).toBe(400);

    expect((await as("delete", `/chats/${id}/members/${encodeURIComponent("bob@mock.test")}`)).status).toBe(204);
    expect((await as("delete", `/chats/${id}/members/bob@mock.test`)).body.error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("gives members access, lets them leave, and keeps them from removing others", async () => {
    const { app } = sharedSetup();
    const owner = await signIn(app);
    const id = await firstChatId(owner.as, "Team plan");
    const bob = await signIn(app, "bob@mock.test");

    expect((await bob.as("get", "/chats")).body.chats).toHaveLength(3);
    expect((await bob.as("get", `/chats/${id}`)).status).toBe(200);
    expect((await bob.as("patch", `/chats/${id}`).send({ title: "x" })).status).toBe(404);
    const forbidden = await bob.as("delete", `/chats/${id}/members/carol@mock.test`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    expect((await bob.as("delete", `/chats/${id}/membership`)).status).toBe(204);
    expect((await bob.as("get", `/chats/${id}`)).status).toBe(404);
  });
});

describe("messages", () => {
  it("lists the history of a chat in the Message DTO shape", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const res = await as("get", `/chats/${id}/messages`);
    const messages = z.array(messageDtoSchema).parse(res.body.messages);
    expect(messages).toHaveLength(4);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(messages.every((m) => m.status === "sent")).toBe(true);
    expect(messages[0]).toMatchObject({ authorEmail: "alice@mock.test" });
    expect(messages[1]).toMatchObject({ authorEmail: null });
  });

  it("keeps the seeded reasoning and web fetch of an answer", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const reasoning = (await as("get", `/chats/${await firstChatId(as, "Reasoning example")}/messages`)).body.messages;
    expect(reasoning[1].reasoning).toContain("First,");
    const web = (await as("get", `/chats/${await firstChatId(as, "Web fetch example")}/messages`)).body.messages;
    expect(web[1].webFetches.map((f: { status: string }) => f.status)).toEqual(["done", "error"]);
  });

  it("sends a message: 201 sent, then an assistant answer is written and completed", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const res = await as("post", `/chats/${id}/messages`).send({ content: "  Hello there " });
    expect(res.status).toBe(201);
    expect(messageDtoSchema.parse(res.body.message)).toMatchObject({
      role: "user",
      content: "Hello there",
      status: "sent",
      authorEmail: "alice@mock.test",
    });

    const messages = await settled(as, id);
    expect(messages).toHaveLength(6);
    const answer = messages[5] as MessageDto;
    expect(answer).toMatchObject({ role: "assistant", status: "sent", authorEmail: null });
    expect(answer.content.trim().split(" ")).toHaveLength(6);
  });

  it("validates the body of a send", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const res = await as("post", `/chats/${id}/messages`).send({ content: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.content).toEqual(["Message content is required"]);
  });

  it("answers a reasoning and web fetch chat with those events", async () => {
    const { app } = setup();
    const { as, cookie } = await signIn(app);
    const id = await firstChatId(as, "Reasoning example");
    const web = await firstChatId(as, "Web fetch example");
    const stream = await openStream(app, cookie, id);
    const webStream = await openStream(app, cookie, web);
    await as("post", `/chats/${id}/messages`).send({ content: "why?" });
    await as("post", `/chats/${web}/messages`).send({ content: "read this" });
    await stream.until((e) => e.some((x) => x.type === "done"));
    await webStream.until((e) => e.some((x) => x.type === "done"));
    expect(stream.events.filter((e) => e.type === "reasoning")).toHaveLength(3);
    expect(webStream.events.filter((e) => e.type === "web_fetch").map((e) => e.type === "web_fetch" && e.fetch.status)).toEqual([
      "fetching",
      "done",
    ]);
    const saved = await settled(as, web);
    expect(saved.at(-1)?.webFetches).toHaveLength(1);
    stream.close();
    webStream.close();
  });
});

describe("chat stream", () => {
  it("streams message, started, tokens and done in the SSE wire format", async () => {
    const { app } = setup();
    const { as, cookie } = await signIn(app);
    const id = await firstChatId(as);
    const stream = await openStream(app, cookie, id);
    expect(stream.response.headers["content-type"]).toBe("text/event-stream");

    const sent = await as("post", `/chats/${id}/messages`).send({ content: "Hi" });
    await stream.until((events) => events.some((e) => e.type === "done"));

    const types = stream.events.map((e) => e.type);
    expect(types[0]).toBe("message");
    expect(types[1]).toBe("started");
    expect(types.filter((t) => t === "token")).toHaveLength(6);
    expect(types.at(-1)).toBe("done");
    expect(stream.raw[0]).toMatch(/^event: message\ndata: \{/);
    expect(stream.events[0]).toMatchObject({ message: { id: sent.body.message.id } });

    const tokens = stream.events.flatMap((e) => (e.type === "token" ? [e.token] : []));
    const answer = (await settled(as, id)).at(-1) as MessageDto;
    expect(answer.content).toBe(tokens.join(""));
    stream.close();
  });

  it("refuses a stream for a chat the user cannot see", async () => {
    const { app } = setup();
    const { as } = await signIn(app, "bob@mock.test");
    const alices = await signIn(app);
    const res = await as("get", `/chats/${await firstChatId(alices.as)}/stream`);
    expect(res.status).toBe(404);
  });

  it("uses the same SEED for the same answer", async () => {
    const answers: string[] = [];
    for (let run = 0; run < 2; run++) {
      const { app } = setup({ SEED: "9" });
      const { as } = await signIn(app);
      const id = await firstChatId(as);
      await as("post", `/chats/${id}/messages`).send({ content: "same" });
      answers.push(((await settled(as, id)).at(-1) as MessageDto).content);
    }
    expect(answers[0]).toBe(answers[1]);
  });
});

describe("queue: edit, cancel, stop and retry", () => {
  const slow = { TTFT_MS: "150", TOKEN_INTERVAL_MS: "5" };

  it("queues a message sent while another streams, and lets its author edit it", async () => {
    const { app } = setup(slow);
    const { as, cookie } = await signIn(app);
    const id = await firstChatId(as);
    const stream = await openStream(app, cookie, id);
    await as("post", `/chats/${id}/messages`).send({ content: "first" });
    const second = await as("post", `/chats/${id}/messages`).send({ content: "second" });
    expect(second.body.message.status).toBe("queued");

    const edited = await as("patch", `/chats/${id}/messages/${second.body.message.id}`).send({ content: "second, edited" });
    expect(edited.status).toBe(200);
    expect(messageDtoSchema.parse(edited.body.message)).toMatchObject({ content: "second, edited", status: "queued" });

    const messages = await settled(as, id);
    const users = messages.filter((m) => m.role === "user").slice(-2);
    expect(users.map((m) => [m.content, m.status])).toEqual([
      ["first", "sent"],
      ["second, edited", "sent"],
    ]);
    expect(messages.slice(-4).map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(stream.events.some((e) => e.type === "queued" && e.messageId === second.body.message.id)).toBe(true);
    stream.close();
  });

  it("cancels a queued message with 204 and removes it", async () => {
    const { app } = setup(slow);
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    await as("post", `/chats/${id}/messages`).send({ content: "first" });
    const second = await as("post", `/chats/${id}/messages`).send({ content: "second" });
    const cancel = await as("delete", `/chats/${id}/messages/${second.body.message.id}`);
    expect(cancel.status).toBe(204);

    const messages = await settled(as, id);
    expect(messages.some((m) => m.content === "second")).toBe(false);
    expect(messages.slice(4).map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("does not reuse the id of a canceled message", async () => {
    const { app } = setup(slow);
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    await as("post", `/chats/${id}/messages`).send({ content: "first" });
    const second = await as("post", `/chats/${id}/messages`).send({ content: "second" });
    await as("delete", `/chats/${id}/messages/${second.body.message.id}`);
    const third = await as("post", `/chats/${id}/messages`).send({ content: "third" });
    expect(third.body.message.id).not.toBe(second.body.message.id);
    await settled(as, id);
  });

  it("answers 409 for a message that already started, 404 for one that is not the user's", async () => {
    const { app } = setup(slow);
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const first = await as("post", `/chats/${id}/messages`).send({ content: "first" });
    const messageId = first.body.message.id as string;

    const edit = await as("patch", `/chats/${id}/messages/${messageId}`).send({ content: "late" });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("MESSAGE_NOT_EDITABLE");
    expect((await as("delete", `/chats/${id}/messages/${messageId}`)).body.error.code).toBe("MESSAGE_NOT_CANCELABLE");
    expect((await as("patch", `/chats/${id}/messages/msg_99999`).send({ content: "x" })).status).toBe(404);
    // an assistant message is not the user's
    const history = (await as("get", `/chats/${id}/messages`)).body.messages as MessageDto[];
    const assistant = history.find((m) => m.role === "assistant") as MessageDto;
    expect((await as("delete", `/chats/${id}/messages/${assistant.id}`)).status).toBe(404);
    await settled(as, id);
  });

  it("stops a streaming answer and keeps what was written", async () => {
    const { app } = setup({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "20", TOKENS: "50" });
    const { as, cookie } = await signIn(app);
    const id = await firstChatId(as);
    const stream = await openStream(app, cookie, id);
    await as("post", `/chats/${id}/messages`).send({ content: "long one" });
    await stream.until((e) => e.some((x) => x.type === "token"));

    const stop = await as("post", `/chats/${id}/stop`);
    expect(stop.body).toEqual({ stopped: true });
    await stream.until((e) => e.some((x) => x.type === "done"));
    expect(stream.events.at(-1)).toMatchObject({ type: "done", stopped: true });

    const answer = (await settled(as, id)).at(-1) as MessageDto;
    expect(answer.status).toBe("sent");
    expect(answer.content.length).toBeGreaterThan(0);
    expect((await as("post", `/chats/${id}/messages/${answer.id}/stop`)).body).toEqual({ stopped: false });
    stream.close();
  });

  it("fails an answer with the error scenario, then retries it with 202 and completes", async () => {
    const { app } = setup();
    const { as, cookie } = await signIn(app);
    const id = await firstChatId(as);
    const stream = await openStream(app, cookie, id);
    await as("post", `/chats/${id}/messages`).set("X-Mock-Scenario", "error").send({ content: "break" });
    await stream.until((e) => e.some((x) => x.type === "error"));
    expect(stream.events.at(-1)).toMatchObject({ type: "error", retryable: true });

    const failed = (await settled(as, id)).at(-1) as MessageDto;
    expect(failed).toMatchObject({ status: "failed", role: "assistant" });
    expect(failed.error).toContain("Mock provider error");

    const retry = await as("post", `/chats/${id}/messages/${failed.id}/retry`);
    expect(retry.status).toBe(202);
    expect(messageDtoSchema.parse(retry.body.message)).toMatchObject({ status: "queued", content: "" });
    const done = (await settled(as, id)).at(-1) as MessageDto;
    expect(done).toMatchObject({ id: failed.id, status: "sent", error: null });
    expect(done.content.length).toBeGreaterThan(0);
    stream.close();
  });

  it("refuses to retry a message that did not fail", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const history = (await as("get", `/chats/${id}/messages`)).body.messages as MessageDto[];
    const res = await as("post", `/chats/${id}/messages/${history[1]?.id}/retry`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MESSAGE_NOT_RETRYABLE");
  });

  it("makes the long scenario ten times as long", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    await as("post", `/chats/${id}/messages`).set("X-Mock-Scenario", "long").send({ content: "more" });
    const answer = (await settled(as, id)).at(-1) as MessageDto;
    expect(answer.content.trim().split(" ")).toHaveLength(60);
  });

  it("reset stops a running answer and restores the seeded history", async () => {
    const { app } = setup({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "20", TOKENS: "200" });
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    await as("post", `/chats/${id}/messages`).send({ content: "run" });
    await request(app).post("/__admin/reset");
    const login = await signIn(app);
    expect((await login.as("get", `/chats/${id}/messages`)).body.messages).toHaveLength(4);
    await wait(60);
    expect((await login.as("get", `/chats/${id}/messages`)).body.messages).toHaveLength(4);
  });

  it("drops the running answer of a deleted chat", async () => {
    const { app } = setup({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "20", TOKENS: "200" });
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    await as("post", `/chats/${id}/messages`).send({ content: "run" });
    expect((await as("delete", `/chats/${id}`)).status).toBe(204);
    await wait(60);
    expect((await as("get", `/chats/${id}/messages`)).status).toBe(404);
  });
});

describe("attachments", () => {
  const multipart = (name: string, mime: string, content = "hello file") =>
    Buffer.from(
      `--XX\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--XX--\r\n`,
    );
  const send = (req: request.Test, body: Buffer) =>
    req.set("Content-Type", "multipart/form-data; boundary=XX").send(body);

  it("returns the seeded attachments with a message", async () => {
    const { app } = setup({ MOCK_DATASET: "attachments" });
    const { as } = await signIn(app);
    const id = await firstChatId(as, "Files");
    const messages = (await as("get", `/chats/${id}/messages`)).body.messages as MessageDto[];
    const withFiles = messages.filter((m) => m.attachments.length > 0);
    expect(withFiles).toHaveLength(4);
    expect(withFiles.map((m) => m.attachments[0]?.kind).sort()).toEqual(["image", "image", "pdf", "text"]);
  });

  it("stores an upload for a message of the user", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const messageId = ((await as("get", `/chats/${id}/messages`)).body.messages as MessageDto[])[0]?.id;
    const res = await send(as("post", `/chats/${id}/messages/${messageId}/attachments`), multipart("notes.txt", "text/plain"));
    expect(res.status).toBe(201);
    expect(res.body.attachment).toMatchObject({ filename: "notes.txt", kind: "text", size: 10, messageId });
    const history = (await as("get", `/chats/${id}/messages`)).body.messages as MessageDto[];
    expect(history[0]?.attachments).toHaveLength(1);
  });

  it("links an upload made before the send through attachmentIds", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const up = await send(as("post", `/chats/${id}/attachments`), multipart("pic.png", "image/png"));
    expect(up.status).toBe(201);
    const sent = await as("post", `/chats/${id}/messages`).send({
      content: "see picture",
      attachmentIds: [up.body.attachment.id],
    });
    expect(sent.body.message.attachments).toMatchObject([{ filename: "pic.png", kind: "image" }]);
    await settled(as, id);
  });

  it.each([
    ["a type that is not accepted", multipart("run.exe", "application/octet-stream"), "ATTACHMENT_TYPE_NOT_ALLOWED"],
    ["a MIME type that does not match", multipart("notes.txt", "application/pdf"), "ATTACHMENT_TYPE_NOT_ALLOWED"],
    ["no file", Buffer.from("--XX--\r\n"), "ATTACHMENT_REQUIRED"],
  ])("rejects %s", async (_label, body, code) => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const res = await send(as("post", `/chats/${id}/attachments`), body);
    expect(res.status).toBe(400);
    expect(http.errorResponseSchema.parse(res.body).error.code).toBe(code);
  });

  it("answers 404 MESSAGE_NOT_FOUND for a message that is not the user's", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    const id = await firstChatId(as);
    const res = await send(as("post", `/chats/${id}/messages/msg_99999/attachments`), multipart("a.txt", "text/plain"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });
});

describe("provider key settings", () => {
  it.each([
    ["a key", "mock-key-1234", { success: true }],
    ["no key", undefined, { success: false, message: "No API key was provided." }],
    ["a rejected key", "invalid-key", { success: false, message: "The provider rejected the API key." }],
  ])("tests the connection with %s", async (_label, key, expected) => {
    const { app } = setup();
    const { as } = await signIn(app);
    const req = as("post", "/providers/openai/test-connection");
    const res = await (key ? req.set("X-Llm-Api-Key", key) : req).send({ provider: "openai" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expected);
  });

  it("answers 404 for an unknown provider", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    expect((await as("post", "/providers/gemini/test-connection").send({})).status).toBe(404);
  });
});

describe("errors", () => {
  it("answers 404 NOT_FOUND for an unknown route and 400 for a malformed body", async () => {
    const { app } = setup();
    const { as } = await signIn(app);
    expect((await as("get", "/nothing")).body.error.code).toBe("NOT_FOUND");
    const res = await as("post", "/chats").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
  });

  it("registers the answer and fault scenarios", async () => {
    const { app } = setup();
    const res = await request(app).get("/__admin/scenarios");
    const names = res.body.scenarios
      .filter((s: { mock: string }) => s.mock === "auth" || s.mock === "conversation")
      .map((s: { mock: string; name: string }) => `${s.mock}/${s.name}`);
    expect(names).toEqual([
      "auth/error-500",
      "auth/session-expired",
      "auth/slow",
      "conversation/error",
      "conversation/error-500",
      "conversation/long",
      "conversation/ok",
      "conversation/session-expired",
      "conversation/slow",
      "conversation/stream-drop",
    ]);
  });
});
