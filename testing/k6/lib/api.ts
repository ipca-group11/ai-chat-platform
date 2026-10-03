import { check } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";
import sse from "k6/x/sse";

/**
 * The real API flow, through the shell (same origin, like the browser, and like Caddy on the VM):
 *   POST /auth/register, POST /auth/login          auth-service (session in httpOnly cookies)
 *   POST /api/chats                                create a chat {title, provider, model}
 *   GET  /api/chats/:id/stream                     SSE stream of the chat (message, started, token, done)
 *   POST /api/chats/:id/messages                   send a message, 201; the answer arrives on the stream
 * `/api` is proxied to conversation-service by the shell (`vite preview`), which strips the prefix.
 */

export const BASE_URL = (__ENV["BASE_URL"] ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const PASSWORD = __ENV["K6_PASSWORD"] ?? "LoadTest-1234";
const EMAIL_DOMAIN = __ENV["K6_EMAIL_DOMAIN"] ?? "loadtest.example.com";
/** Any text works: the LLM mock accepts every key. */
const LLM_KEY = __ENV["LLM_API_KEY"] ?? "k6-dummy-key";
const MODEL = __ENV["LLM_MODEL"] ?? "claude-sonnet-4-5";
/** Longest a stream may stay open before it counts as failed. */
const STREAM_TIMEOUT_MS = Number(__ENV["STREAM_TIMEOUT_MS"] ?? 60_000);

/** Time from sending a message to the first token event on the stream, in ms. */
export const timeToFirstToken = new Trend("time_to_first_token", true);
/** Time from sending a message to the done event, in ms. */
export const streamDuration = new Trend("stream_duration", true);
/** Share of streams that ended with `done` and no error. */
export const streamSuccess = new Rate("stream_success_rate");
export const tokensReceived = new Counter("tokens_received");

const jsonHeaders = { "Content-Type": "application/json" };

/** State of one virtual user; k6 keeps module variables per VU between iterations. */
const vu: { signedIn: boolean; chatId: string | undefined } = { signedIn: false, chatId: undefined };

type Tags = { level: string };

const restTags = (name: string, tags: Tags) => ({ kind: "rest", name, level: tags.level });

function signIn(): boolean {
  const email = `k6-vu${__VU}@${EMAIL_DOMAIN}`;
  const body = JSON.stringify({ email, password: PASSWORD });
  const registered = http.post(`${BASE_URL}/auth/register`, body, {
    headers: jsonHeaders,
    tags: { kind: "auth", name: "register" },
  });
  // 201 = new account, 409 = left by a previous run; both lead to a login.
  check(registered, { "register: 201 or 409": (r) => r.status === 201 || r.status === 409 });
  const login = http.post(`${BASE_URL}/auth/login`, body, { headers: jsonHeaders, tags: { kind: "auth", name: "login" } });
  vu.signedIn = check(login, { "login: 200": (r) => r.status === 200 });
  return vu.signedIn;
}

function ensureSession(): boolean {
  return vu.signedIn || signIn();
}

/** A REST call; a 401 (expired access token in a long soak run) signs in again once. */
function rest(method: "GET" | "POST", path: string, name: string, tags: Tags, body?: object, headers: Record<string, string> = {}) {
  const send = () =>
    http.request(method, `${BASE_URL}${path}`, body ? JSON.stringify(body) : null, {
      headers: { ...jsonHeaders, ...headers },
      tags: restTags(name, tags),
    });
  let res = send();
  if (res.status === 401 && signIn()) res = send();
  return res;
}

function ensureChat(tags: Tags): string | undefined {
  if (vu.chatId) return vu.chatId;
  const res = rest("POST", "/api/chats", "create_chat", tags, {
    title: `k6 chat ${__VU}`,
    provider: "anthropic",
    model: MODEL,
  });
  check(res, { "create chat: 201": (r) => r.status === 201 });
  const id = res.status === 201 ? (res.json("chat.id") as string | undefined) : undefined;
  vu.chatId = typeof id === "string" ? id : undefined;
  return vu.chatId;
}

/** Signs in and has a chat ready; false when either failed. */
export function prepare(tags: Tags): string | undefined {
  if (!ensureSession()) return undefined;
  return ensureChat(tags);
}

/** What a user does when they open the app: the chat list, then one chat with its messages. */
export function browseOnce(tags: Tags): void {
  const chatId = prepare(tags);
  const list = rest("GET", "/api/chats", "list_chats", tags);
  check(list, { "list chats: 200": (r) => r.status === 200 });
  if (!chatId) return;
  const messages = rest("GET", `/api/chats/${chatId}/messages`, "list_messages", tags);
  check(messages, { "list messages: 200": (r) => r.status === 200 });
}

function cookieHeader(): string {
  const jar = http.cookieJar().cookiesForURL(`${BASE_URL}/`);
  return Object.entries(jar)
    .map(([name, values]) => `${name}=${values[0] ?? ""}`)
    .join("; ");
}

/**
 * Sends one message, opens the chat stream and reads events until `done`. The time to first
 * token runs from just before the message is sent to the first `token` event.
 */
export function streamOnce(tags: Tags): boolean {
  const chatId = prepare(tags);
  if (!chatId) {
    streamSuccess.add(false, tags);
    return false;
  }
  let sentAt = 0;
  let firstTokenMs = -1;
  let finished = false;
  let failed = false;
  let tokens = 0;

  // The shell proxy (`vite preview`) sends the response head of a stream together with its first
  // event, and the xk6-sse client runs its callback only once the head is in. A stream opened
  // first would therefore wait for an event that only the message can cause. So the message is
  // sent first and the stream opened right after: the model needs TTFT_MS to produce the first
  // token, which is time enough for the service to register the stream. A stream that comes too
  // late to see `done` times out and counts as failed, which is what overload looks like to a user.
  sentAt = Date.now();
  const sent = http.post(`${BASE_URL}/api/chats/${chatId}/messages`, JSON.stringify({ content: "Tell me a short story about a lighthouse." }), {
    headers: { ...jsonHeaders, "X-Llm-Api-Key": LLM_KEY },
    tags: restTags("send_message", tags),
  });
  if (sent.status !== 201) {
    streamSuccess.add(false, tags);
    return false;
  }

  const response = sse.open(
    `${BASE_URL}/api/chats/${chatId}/stream`,
    { method: "GET", headers: { Accept: "text/event-stream", Cookie: cookieHeader() }, tags: { kind: "stream", name: "stream", level: tags.level } },
    (client) => {
      const timer = setTimeout(() => {
        failed = true;
        client.close();
      }, STREAM_TIMEOUT_MS);
      client.on("event", (event) => {
        let data: { type?: string } | undefined;
        try {
          data = JSON.parse(event.data) as { type?: string };
        } catch {
          return;
        }
        if (data.type === "token") {
          tokens += 1;
          if (firstTokenMs < 0 && sentAt > 0) firstTokenMs = Date.now() - sentAt;
        } else if (data.type === "done" || data.type === "error") {
          finished = true;
          failed = failed || data.type === "error";
          clearTimeout(timer);
          client.close();
        }
      });
      client.on("error", () => {
        failed = true;
        clearTimeout(timer);
        client.close();
      });
    },
  );

  const ok = response.status === 200 && finished && !failed && firstTokenMs >= 0;
  check(response, { "stream: status 200": (r) => r.status === 200 });
  if (firstTokenMs >= 0) timeToFirstToken.add(firstTokenMs, tags);
  if (finished && sentAt > 0) streamDuration.add(Date.now() - sentAt, tags);
  tokensReceived.add(tokens, tags);
  streamSuccess.add(ok, tags);
  return ok;
}

/** A user checks the chat list once the answer is in (keeps the REST thresholds fed during stream runs). */
export function listChats(tags: Tags): void {
  const list = rest("GET", "/api/chats", "list_chats", tags);
  check(list, { "list chats: 200": (r) => r.status === 200 });
}
