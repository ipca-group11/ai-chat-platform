import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppClient, cookieHeaderFrom } from "./client.ts";
import { FakeApp } from "./test-utils/fake-app.ts";

let app: FakeApp;
let baseUrl: string;

beforeEach(async () => {
  app = new FakeApp();
  baseUrl = await app.start();
});
afterEach(async () => {
  await app.stop();
});

const chatOptions = { title: "t", provider: "anthropic", model: "claude-haiku-4-5", webFetch: false } as const;

describe("cookieHeaderFrom", () => {
  it("keeps name=value of each cookie and drops empty ones", () => {
    expect(cookieHeaderFrom(["a=1; Path=/; HttpOnly", "b=2", "gone=", "junk"])).toBe("a=1; b=2");
  });
});

describe("AppClient", () => {
  it("registers, signs in and sends the session cookie on later calls", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "pw-1234567a1");
    await client.createChat(chatOptions);
    expect(app.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /auth/register", "POST /auth/login", "POST /api/chats"]);
    expect(app.calls[2]?.cookie).toBe("access_token=tok; refresh_token=ref");
  });

  it("accepts an account that already exists (409) and fails on any other register error", async () => {
    app.statusOverride["POST /auth/register"] = 409;
    await expect(new AppClient(baseUrl).signUp("a@redteam.example.com", "x")).resolves.toBeUndefined();
    app.statusOverride["POST /auth/register"] = 500;
    await expect(new AppClient(baseUrl).signUp("a@redteam.example.com", "x")).rejects.toThrow(/register failed: HTTP 500/);
  });

  it("fails when the login is refused", async () => {
    app.statusOverride["POST /auth/login"] = 401;
    await expect(new AppClient(baseUrl).signUp("a@redteam.example.com", "x")).rejects.toThrow(/login failed: HTTP 401/);
  });

  it("returns the chat id and the message id, and sends the key in the header", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    const chatId = await client.createChat(chatOptions);
    expect(chatId).toMatch(/^chat-/);
    const messageId = await client.sendMessage(chatId, "hi", "k-123");
    expect(messageId).toMatch(/^msg-/);
    expect(app.calls.at(-1)).toMatchObject({ apiKey: "k-123", body: JSON.stringify({ content: "hi" }) });
  });

  it("adds a member and uploads a file as multipart to the message", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    await client.addMember("chat-1", "b@redteam.example.com");
    await client.upload("chat-1", "msg-1", { filename: "a.png", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
    const upload = app.calls.at(-1);
    expect(upload?.path).toBe("/api/chats/chat-1/messages/msg-1/attachments");
    expect(upload?.body).toContain('filename="a.png"');
  });

  it.each([
    ["create chat", "POST /api/chats"],
    ["add member", "POST /api/chats/c/members"],
    ["send message", "POST /api/chats/c/messages"],
    ["upload", "POST /api/chats/c/messages/m/attachments"],
  ])("names the step when %s fails", async (step, route) => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    app.statusOverride[route] = 422;
    const call = {
      "create chat": () => client.createChat(chatOptions),
      "add member": () => client.addMember("c", "b@x.test"),
      "send message": () => client.sendMessage("c", "hi", "k"),
      upload: () => client.upload("c", "m", { filename: "a.txt", mimeType: "text/plain", bytes: new Uint8Array() }),
    }[step] as () => Promise<unknown>;
    await expect(call()).rejects.toThrow(new RegExp(`${step} failed: HTTP 422`));
  });

  it("reads the answer and the fetched URLs from the stream, and ignores events of other messages", async () => {
    app.reply = () => ({ tokens: ["Hel", "lo"], fetchUrls: ["https://a.test/x", "https://a.test/x", "https://b.test/"] });
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    const chatId = await client.createChat(chatOptions);
    const reply = await client.ask(chatId, "hi", "k");
    expect(reply).toMatchObject({ text: "Hello", fetchedUrls: ["https://a.test/x", "https://b.test/"] });
    expect(reply.error).toBeUndefined();
  });

  it("keeps a fetch the domain list refused out of the fetched URLs (AICHAT-242)", async () => {
    app.reply = () => ({ tokens: ["ok"], fetchUrls: ["https://a.test/x"], refusedUrls: ["https://attacker.example/log"] });
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    const reply = await client.ask(await client.createChat(chatOptions), "hi", "k");
    expect(reply).toMatchObject({ fetchedUrls: ["https://a.test/x"], refusedUrls: ["https://attacker.example/log"] });
  });

  it("returns the provider error of an error event", async () => {
    app.reply = () => ({ tokens: ["x"], error: "invalid key" });
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    const reply = await client.ask(await client.createChat(chatOptions), "hi", "k");
    expect(reply.error).toBe("invalid key");
  });

  it("runs afterSend once the message exists", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    const seen: string[] = [];
    await client.ask(await client.createChat(chatOptions), "hi", "k", { afterSend: async (id) => void seen.push(id) });
    expect(seen).toHaveLength(1);
  });

  it("gives up with a clear error when the reply never ends", async () => {
    app.reply = () => ({ hang: true });
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    await expect(client.ask(await client.createChat(chatOptions), "hi", "k", { timeoutMs: 150 })).rejects.toThrow(/timed out/);
  });

  it("fails when the stream cannot be opened", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    app.statusOverride["GET /api/chats/c/stream"] = 403;
    await expect(client.ask("c", "hi", "k")).rejects.toThrow(/open stream failed: HTTP 403/);
  });

  it("does not leave an unhandled error when sending fails after the stream opened", async () => {
    const client = new AppClient(baseUrl);
    await client.signUp("a@redteam.example.com", "x");
    app.statusOverride["POST /api/chats/c/messages"] = 500;
    await expect(client.ask("c", "hi", "k")).rejects.toThrow(/send message failed/);
  });
});
