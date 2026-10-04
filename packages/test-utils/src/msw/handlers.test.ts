/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted field by field */
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { fixtures } from "./fixtures";
import { recordRequests, server } from "./server";

const json = async (response: Response) => (await response.json()) as Record<string, any>;
const post = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("auth handlers", () => {
  it("register answers 201 with the new user", async () => {
    const response = await post("/auth/register", { email: "new@example.test", password: "Secret-123" });

    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({ id: fixtures.user.id, email: "new@example.test" });
  });

  it("login answers with the user of the request", async () => {
    const response = await post("/auth/login", { email: "me@example.test", password: "Secret-123" });

    expect(await json(response)).toEqual({ id: fixtures.user.id, email: "me@example.test" });
  });

  it("login and register fall back to the fixture user when the body has no email", async () => {
    expect(await json(await post("/auth/login"))).toMatchObject({ email: fixtures.user.email });
    expect(await json(await post("/auth/register"))).toMatchObject({ email: fixtures.user.email });
  });

  it("refresh and logout answer 204", async () => {
    expect((await post("/auth/refresh")).status).toBe(204);
    expect((await post("/auth/logout")).status).toBe(204);
  });

  it("deleting the account answers 204 with a password, and 400 VALIDATION_ERROR without one", async () => {
    const remove = (body?: unknown) =>
      fetch("/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    expect((await remove({ password: "Secret-123" })).status).toBe(204);
    const missing = await remove({});
    expect(missing.status).toBe(400);
    expect((await json(missing)).error.code).toBe("VALIDATION_ERROR");
    expect((await remove()).status).toBe(400);
  });

  it("me answers with the current user, whatever the base URL", async () => {
    const same = await json(await fetch("/auth/me"));
    const other = await json(await fetch("http://auth-service:4001/auth/me"));

    expect(same).toEqual({ id: fixtures.user.id, email: fixtures.user.email });
    expect(other).toEqual(same);
  });
});

describe("chat handlers", () => {
  it("lists the chats in the service envelope, with the owner email", async () => {
    const body = await json(await fetch("/api/chats"));

    expect(body.chats).toEqual([expect.objectContaining({ id: fixtures.chat.id, ownerEmail: fixtures.user.email })]);
  });

  it("creates a chat from the request body", async () => {
    const response = await post("/api/chats", { title: "Fresh", provider: "openai", model: "gpt-4.1" });

    expect(response.status).toBe(201);
    expect((await json(response)).chat).toMatchObject({ id: "chat_new", title: "Fresh", provider: "openai" });
  });

  it("reads, renames and deletes a chat by id", async () => {
    expect((await json(await fetch("/api/chats/chat_9"))).chat.id).toBe("chat_9");
    const renamed = await fetch("/api/chats/chat_9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed" }),
    });
    expect((await json(renamed)).chat).toMatchObject({ id: "chat_9", title: "Renamed" });
    expect((await fetch("/api/chats/chat_9", { method: "DELETE" })).status).toBe(204);
  });

  it("lists, adds and removes members; the owner comes first", async () => {
    const members = (await json(await fetch("/api/chats/chat_1/members"))).members;
    expect(members.map((m: { role: string }) => m.role)).toEqual(["owner", "member"]);

    const added = await post("/api/chats/chat_1/members", { email: "friend@example.test" });
    expect(added.status).toBe(201);
    expect((await json(added)).member).toMatchObject({ email: "friend@example.test", role: "member" });
    expect((await json(await post("/api/chats/chat_1/members"))).member.email).toBe(fixtures.guest.email);

    expect((await fetch("/api/chats/chat_1/members/friend@example.test", { method: "DELETE" })).status).toBe(204);
    expect((await fetch("/api/chats/chat_1/membership", { method: "DELETE" })).status).toBe(204);
  });
});

describe("message handlers", () => {
  it("lists the messages of the chat with their attachments, statuses in the service wording", async () => {
    const { messages } = await json(await fetch("/api/chats/chat_7/messages"));

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ chatId: "chat_7", role: "user", status: "sent" });
    expect(messages[0].attachments).toEqual([expect.objectContaining({ filename: "notes.txt", kind: "text" })]);
    expect(messages[1]).toMatchObject({ role: "assistant", status: "sent", attachments: [] });
  });

  it("sends a message and answers 201 with the content of the request", async () => {
    const response = await post("/api/chats/chat_7/messages", { content: "Question?" });

    expect(response.status).toBe(201);
    expect((await json(response)).message).toMatchObject({ chatId: "chat_7", content: "Question?" });
    expect((await json(await post("/api/chats/chat_7/messages"))).message.content).toBe(fixtures.userMessage.content);
  });

  it("edits a queued message", async () => {
    const response = await fetch("/api/chats/chat_7/messages/msg_3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Edited" }),
    });

    expect((await json(response)).message).toMatchObject({ id: "msg_3", content: "Edited", status: "queued" });
    const unchanged = await fetch("/api/chats/chat_7/messages/msg_3", { method: "PATCH" });
    expect((await json(unchanged)).message.content).toBe(fixtures.userMessage.content);
  });

  it("cancels, retries and stops", async () => {
    expect((await fetch("/api/chats/chat_7/messages/msg_3", { method: "DELETE" })).status).toBe(204);
    const retry = await post("/api/chats/chat_7/messages/msg_3/retry");
    expect(retry.status).toBe(202);
    expect((await json(retry)).message).toMatchObject({ id: "msg_3", status: "queued" });
    expect(await json(await post("/api/chats/chat_7/messages/msg_3/stop"))).toEqual({ stopped: true });
    expect(await json(await post("/api/chats/chat_7/stop"))).toEqual({ stopped: true });
  });

  it("accepts an attachment upload", async () => {
    const response = await fetch("/api/chats/chat_7/attachments", { method: "POST", body: new FormData() });

    expect(response.status).toBe(201);
    expect((await json(response)).attachment).toMatchObject({ id: fixtures.attachment.id, mimeType: "text/plain" });
  });
});

describe("settings handlers", () => {
  it("test-connection succeeds when the key header is present", async () => {
    const response = await post("/providers/openai/test-connection", { provider: "openai" }, { "X-Llm-Api-Key": "sk-test" });

    expect(await json(response)).toEqual({ success: true });
  });

  it("test-connection explains what is missing when there is no key", async () => {
    const response = await post("/providers/openai/test-connection", { provider: "openai" });

    expect(await json(response)).toEqual({ success: false, message: "No API key was provided." });
  });
});

describe("server", () => {
  it("lets a test override one response", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ message: "expired" }, { status: 401 })));

    expect((await fetch("/auth/me")).status).toBe(401);
  });

  it("drops the override after the test", async () => {
    expect((await fetch("/auth/me")).status).toBe(200);
  });

  it("fails a request that no handler describes", async () => {
    await expect(fetch("/not-described")).rejects.toThrow();
  });
});

describe("recordRequests", () => {
  it("collects the requests made after it was called, with their bodies still readable", async () => {
    const requests = recordRequests();

    await post("/auth/login", { email: "me@example.test" });
    await fetch("/auth/me");

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/login", "GET /auth/me"]);
    expect(await requests[0]!.json()).toEqual({ email: "me@example.test" });
  });

  it("starts empty in the next test", async () => {
    const requests = recordRequests();

    expect(requests).toEqual([]);
  });
});
