import { SseParser } from "./sse.ts";

export type FetchFn = typeof fetch;

/** The answer of the app to one message, read from the SSE stream of the chat. */
export interface Reply {
  text: string;
  /** URLs of every `web_fetch` event, in order, without repeats. */
  fetchedUrls: string[];
  /** `error` event: the provider failed (a wrong key, an overloaded model). */
  error?: string;
  messageId?: string;
}

export interface AttachmentInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface AskOptions {
  /** How long to wait for the end of the reply. */
  timeoutMs?: number;
  /** Runs once the message exists, for example to attach a file to it. */
  afterSend?: (messageId: string) => Promise<void>;
}

export interface ChatOptions {
  title: string;
  provider: "anthropic" | "openai";
  model: string;
  webFetch: boolean;
}

/** Header the browser uses to send the provider key with a message (never stored by the service). */
// nosemgrep: node_api_key
const API_KEY_HEADER = "X-Llm-Api-Key";

/** Name=value pairs of Set-Cookie headers, joined into one Cookie header value. */
export function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter((pair) => pair.includes("=") && !pair.endsWith("="))
    .join("; ");
}

/**
 * Calls the app the way the browser does, through the shell on one base URL: `/auth` for the account and
 * `/api/chats` for chats, messages, files and the SSE stream. Each instance is one signed-in user.
 */
export class AppClient {
  private cookie = "";
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;

  constructor(baseUrl: string, fetchFn: FetchFn = fetch) {
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn;
  }

  /** Creates the account (an existing one is fine) and signs in. */
  async signUp(email: string, password: string): Promise<void> {
    const registered = await this.request("POST", "/auth/register", { email, password });
    if (registered.status !== 201 && registered.status !== 409) throw await failure("register", registered);
    const login = await this.request("POST", "/auth/login", { email, password });
    if (login.status !== 200) throw await failure("login", login);
    this.cookie = cookieHeaderFrom(login.headers.getSetCookie());
    if (!this.cookie) throw new Error("login returned no session cookie");
  }

  async createChat(options: ChatOptions): Promise<string> {
    const res = await this.request("POST", "/api/chats", options);
    if (res.status !== 201) throw await failure("create chat", res);
    return ((await res.json()) as { chat: { id: string } }).chat.id;
  }

  async addMember(chatId: string, email: string): Promise<void> {
    const res = await this.request("POST", `/api/chats/${chatId}/members`, { email });
    if (res.status !== 201 && res.status !== 200) throw await failure("add member", res);
  }

  async sendMessage(chatId: string, content: string, apiKey: string): Promise<string> {
    const res = await this.request("POST", `/api/chats/${chatId}/messages`, { content }, { [API_KEY_HEADER]: apiKey });
    if (res.status !== 201) throw await failure("send message", res);
    return ((await res.json()) as { message: { id: string } }).message.id;
  }

  /** Attaches a file to a message the user sent (the service only accepts a file for an existing message). */
  async upload(chatId: string, messageId: string, file: AttachmentInput): Promise<void> {
    const form = new FormData();
    form.append("file", new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.mimeType }), file.filename);
    const res = await this.request("POST", `/api/chats/${chatId}/messages/${messageId}/attachments`, form);
    if (res.status !== 201) throw await failure("upload", res);
  }

  /**
   * Sends a message and returns the answer. The stream is opened first, because events are not replayed,
   * and read until the reply ends (`done` or `error`) or `timeoutMs` passes.
   */
  async ask(chatId: string, content: string, apiKey: string, options: AskOptions = {}): Promise<Reply> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const stream = await this.request("GET", `/api/chats/${chatId}/stream`, undefined, undefined, abort.signal);
      if (!stream.ok || !stream.body) throw await failure("open stream", stream);
      const reading = readReply(stream.body, abort.signal);
      reading.catch(() => undefined); // reported below; avoids an unhandled rejection if sending fails first
      const messageId = await this.sendMessage(chatId, content, apiKey);
      await options.afterSend?.(messageId);
      return await reading;
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  }

  private request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<Response> {
    const isForm = body instanceof FormData;
    return this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  }
}

async function failure(step: string, res: Response): Promise<Error> {
  // The body is the service's error JSON; it never holds a key or a cookie.
  return new Error(`${step} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

interface StreamData {
  messageId?: string;
  token?: string;
  message?: string;
  fetch?: { url?: string };
}

/** Reads the stream until the reply ends. Only the first reply that starts after the stream opened is followed. */
async function readReply(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<Reply> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const reply: Reply = { text: "", fetchedUrls: [] };
  try {
    for (;;) {
      if (signal.aborted) throw new Error("timed out waiting for the end of the reply");
      const { value, done } = await reader.read();
      if (done) throw new Error("the stream closed before the reply ended");
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        const data = (frame.data ?? {}) as StreamData;
        if (frame.event === "started" && reply.messageId === undefined) reply.messageId = data.messageId;
        if (reply.messageId === undefined || data.messageId !== reply.messageId) continue;
        if (frame.event === "token") reply.text += data.token ?? "";
        else if (frame.event === "web_fetch") {
          const url = data.fetch?.url;
          if (url && !reply.fetchedUrls.includes(url)) reply.fetchedUrls.push(url);
        } else if (frame.event === "error") return { ...reply, error: data.message ?? "unknown error" };
        else if (frame.event === "done") return reply;
      }
    }
  } catch (error) {
    // Reading a stream that the timeout aborted throws an AbortError; say what happened instead.
    if (signal.aborted) throw new Error("timed out waiting for the end of the reply", { cause: error });
    throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
