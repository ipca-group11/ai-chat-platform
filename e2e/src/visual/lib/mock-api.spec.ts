import type { Page, Route } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { CHATS, MESSAGES, USER } from "./data.js";
import { answer, EMPTY_CHATS, installApiMocks, SHELL_ORIGIN, SIGNED_OUT, WITH_CHATS } from "./mock-api.js";

describe("answer", () => {
  it("returns the session in the shape auth-service uses, or 401 when signed out", () => {
    expect(answer(WITH_CHATS, "GET", "/auth/me")).toEqual({ status: 200, body: { id: USER.id, email: USER.email } });
    expect(answer(SIGNED_OUT, "GET", "/auth/me")?.status).toBe(401);
  });

  it("wraps lists and single items in the envelopes conversation-service uses", () => {
    expect(answer(WITH_CHATS, "GET", "/api/chats")).toEqual({ status: 200, body: { chats: CHATS } });
    expect(answer(EMPTY_CHATS, "GET", "/api/chats")).toEqual({ status: 200, body: { chats: [] } });
    expect(answer(WITH_CHATS, "GET", "/api/chats/chat-2")).toEqual({ status: 200, body: { chat: CHATS[1] } });
    expect(answer(WITH_CHATS, "GET", "/api/chats/nope")?.status).toBe(404);
  });

  it("returns only the messages of the chat asked for", () => {
    const reply = answer(WITH_CHATS, "GET", "/api/chats/chat-1/messages");
    expect(reply?.body).toEqual({ messages: MESSAGES.filter((m) => m.chatId === "chat-1") });
    expect(answer(WITH_CHATS, "GET", "/api/chats/chat-2/messages")?.body).toEqual({ messages: [] });
  });

  it("lists the owner as the only member", () => {
    const body = answer(WITH_CHATS, "GET", "/api/chats/chat-1/members")?.body as { members: { role: string }[] };
    expect(body.members.map((m) => m.role)).toEqual(["owner"]);
  });

  it("does not know writes or other paths", () => {
    expect(answer(WITH_CHATS, "POST", "/api/chats")).toBeUndefined();
    expect(answer(WITH_CHATS, "GET", "/api/other")).toBeUndefined();
  });
});

describe("installApiMocks", () => {
  type Matcher = (url: URL) => boolean;
  type Handler = (route: Route) => Promise<void>;

  async function setup(scenario = WITH_CHATS) {
    let matcher: Matcher | undefined;
    let handler: Handler | undefined;
    const page = {
      route: (m: Matcher, h: Handler) => {
        matcher = m;
        handler = h;
        return Promise.resolve();
      },
    } as unknown as Page;
    const unexpected = await installApiMocks(page, scenario);
    const call = async (method: string, path: string) => {
      const out: { status?: number; contentType?: string; body?: string } = {};
      const route = {
        request: () => ({ method: () => method, url: () => `${SHELL_ORIGIN}${path}` }),
        fulfill: (o: { status: number; contentType: string; body: string }) => {
          Object.assign(out, o);
          return Promise.resolve();
        },
      } as unknown as Route;
      await handler?.(route);
      return out;
    };
    return { matcher: matcher as Matcher, call, unexpected };
  }

  it("only handles /api and /auth on the shell origin", async () => {
    const { matcher } = await setup();
    expect(matcher(new URL(`${SHELL_ORIGIN}/api/chats`))).toBe(true);
    expect(matcher(new URL(`${SHELL_ORIGIN}/auth/me`))).toBe(true);
    expect(matcher(new URL(`${SHELL_ORIGIN}/assets/api-client.js`))).toBe(false);
    expect(matcher(new URL("http://localhost:5002/api/chats"))).toBe(false);
  });

  it("fulfils known calls with JSON and keeps the chat stream open and silent", async () => {
    const { call, unexpected } = await setup();
    const chats = await call("GET", "/api/chats");
    expect(chats.status).toBe(200);
    expect(chats.contentType).toBe("application/json");
    expect(JSON.parse(chats.body ?? "")).toEqual({ chats: CHATS });
    const stream = await call("GET", "/api/chats/chat-1/stream");
    expect(stream.contentType).toBe("text/event-stream");
    expect(unexpected).toEqual([]);
  });

  it("answers 501 and records a call nobody mocked", async () => {
    const { call, unexpected } = await setup();
    const reply = await call("POST", "/api/chats");
    expect(reply.status).toBe(501);
    expect(unexpected).toEqual(["POST /api/chats"]);
  });
});
