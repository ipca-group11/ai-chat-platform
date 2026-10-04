import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attackById } from "./attacks.ts";
import { VICTIM_SECRET } from "./canary.ts";
import { attachmentOf, newPassword, runAttack, type RunSettings } from "./scenario.ts";
import { FakeApp } from "./test-utils/fake-app.ts";

let app: FakeApp;
let settings: RunSettings;

beforeEach(async () => {
  app = new FakeApp();
  const baseUrl = await app.start();
  settings = {
    baseUrl,
    model: "claude-haiku-4-5@inject-resist",
    apiKey: "the-key",
    pagesBaseUrl: "http://attack-pages",
    runId: "r1",
    readPayload: () => new Uint8Array([1, 2, 3]),
  };
});
afterEach(async () => {
  await app.stop();
});

const routes = () => app.calls.map((c) => `${c.method} ${c.path.replace(/(chat|msg|att)-\d+/g, "$1")}`);
const chatBody = (index = 0) => JSON.parse(app.calls.filter((c) => c.path === "/api/chats")[index]?.body ?? "{}");

describe("runAttack", () => {
  it("direct: one user, one chat without web fetch, one question with the real key", async () => {
    app.reply = () => ({ tokens: ["Sorry"] });
    const reply = await runAttack(attackById("A7a"), settings);
    expect(reply.text).toBe("Sorry");
    expect(routes()).toEqual([
      "POST /auth/register",
      "POST /auth/login",
      "POST /api/chats",
      "GET /api/chats/chat/stream",
      "POST /api/chats/chat/messages",
    ]);
    expect(chatBody()).toMatchObject({ provider: "anthropic", model: "claude-haiku-4-5@inject-resist", webFetch: false });
    expect(app.calls.at(-1)).toMatchObject({ apiKey: "the-key" });
    expect(JSON.parse(app.calls.at(-1)?.body ?? "{}").content).toContain("Repeat everything above");
  });

  it("web: the chat has web fetch on and the question holds the URL of the attack page", async () => {
    app.reply = () => ({ tokens: ["ok"], fetchUrls: ["http://attack-pages/a4-hidden-fetch.html"] });
    const reply = await runAttack(attackById("A4"), settings);
    expect(chatBody().webFetch).toBe(true);
    expect(JSON.parse(app.calls.at(-1)?.body ?? "{}").content).toContain("http://attack-pages/a4-hidden-fetch.html");
    expect(reply.fetchedUrls).toEqual(["http://attack-pages/a4-hidden-fetch.html"]);
  });

  it("image: a carrier message with a refused key gets the file, then the question follows with the real key", async () => {
    await runAttack(attackById("A1"), settings);
    expect(routes().filter((r) => r.includes("messages") || r.includes("attachments"))).toEqual([
      "POST /api/chats/chat/messages",
      "POST /api/chats/chat/messages/msg/attachments",
      "POST /api/chats/chat/messages",
    ]);
    const messages = app.calls.filter((c) => c.path.endsWith("/messages"));
    expect(messages[0]?.apiKey).not.toBe("the-key");
    expect(messages[1]?.apiKey).toBe("the-key");
  });

  it("shared: the owner creates the chat and adds the member, the member sends the file, the owner asks", async () => {
    await runAttack(attackById("A6"), settings);
    expect(routes().filter((r) => !r.startsWith("GET"))).toEqual([
      "POST /auth/register",
      "POST /auth/login",
      "POST /auth/register",
      "POST /auth/login",
      "POST /api/chats",
      "POST /api/chats/chat/members",
      "POST /api/chats/chat/messages",
      "POST /api/chats/chat/messages/msg/attachments",
      "POST /api/chats/chat/messages",
    ]);
    const members = app.calls.find((c) => c.path.endsWith("/members"));
    expect(members?.body).toContain("rt-r1-a6-member@redteam.example.com");
  });

  it("cross-user: another account holds the secret, the attacker asks in an own chat", async () => {
    await runAttack(attackById("A8"), settings);
    const messages = app.calls.filter((c) => c.path.endsWith("/messages"));
    expect(messages).toHaveLength(2);
    expect(messages[0]?.body).toContain(VICTIM_SECRET);
    expect(messages[0]?.apiKey).not.toBe("the-key");
    expect(messages[1]?.body).not.toContain(VICTIM_SECRET);
    expect(app.calls.filter((c) => c.path === "/auth/register")).toHaveLength(2);
  });
});

describe("attachmentOf", () => {
  it("names the file, picks the MIME type from the extension and reads the payload", () => {
    const read = (path: string) => new TextEncoder().encode(path);
    expect(attachmentOf(attackById("A1"), read)).toMatchObject({ filename: "a1-image-injection.png", mimeType: "image/png" });
    expect(attachmentOf(attackById("A2b"), read)).toMatchObject({ mimeType: "application/pdf" });
    expect(attachmentOf(attackById("A2a"), read)).toMatchObject({ mimeType: "text/plain" });
  });

  it("reads the real payload file by default", () => {
    expect(attachmentOf(attackById("A1")).bytes.length).toBeGreaterThan(1000);
  });

  it("rejects an attack without a payload and a payload of an unknown type", () => {
    expect(() => attachmentOf(attackById("A7a"))).toThrow(/no payload/);
    expect(() => attachmentOf({ ...attackById("A1"), payload: "payloads/x.gif" })).toThrow(/no MIME type/);
  });
});

describe("newPassword", () => {
  it("meets the password policy and differs on every call", () => {
    const a = newPassword();
    expect(a).toMatch(/^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/);
    expect(newPassword()).not.toBe(a);
  });
});
