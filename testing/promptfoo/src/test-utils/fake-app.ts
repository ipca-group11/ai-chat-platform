import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** What the fake app answers to a message: tokens, pages it fetched, or a provider error. */
export interface FakeReply {
  tokens?: string[];
  fetchUrls?: string[];
  /** Fetches the tool refuses for its domain list: `fetching`, then an error `url_not_allowed`. */
  refusedUrls?: string[];
  error?: string;
  /** Never ends the reply, to test the timeout. */
  hang?: boolean;
}

export interface FakeCall {
  method: string;
  path: string;
  body: string;
  apiKey: string | undefined;
  cookie: string | undefined;
}

/** A small stand-in for the shell: the routes AppClient uses, with a scripted reply per message. */
export class FakeApp {
  readonly calls: FakeCall[] = [];
  private server: Server | undefined;
  private readonly streams = new Set<ServerResponse>();
  private nextId = 1;
  /** Picks the reply for a message; default: "ok". */
  reply: (content: string, apiKey: string | undefined) => FakeReply = () => ({ tokens: ["ok"] });
  /** Status for a route, to test failures: key `METHOD /path`. */
  statusOverride: Record<string, number> = {};

  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    for (const stream of this.streams) stream.destroy();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private publish(event: string, data: unknown): void {
    for (const stream of this.streams) stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf-8");
    const path = req.url ?? "";
    const method = req.method ?? "GET";
    const header = (name: string): string | undefined => {
      const value = req.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    this.calls.push({ method, path, body, apiKey: header("x-llm-api-key"), cookie: header("cookie") });

    const forced = this.statusOverride[`${method} ${path}`];
    if (forced) {
      res.writeHead(forced, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: "FORCED", message: "forced failure" } }));
      return;
    }
    const json = (status: number, payload: unknown, headers: Record<string, string | string[]> = {}): void => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(payload));
    };

    if (method === "POST" && path === "/auth/register") return json(201, {});
    if (method === "POST" && path === "/auth/login") {
      return json(200, {}, { "Set-Cookie": ["access_token=tok; Path=/; HttpOnly", "refresh_token=ref; Path=/; HttpOnly", "empty="] });
    }
    if (method === "POST" && path === "/api/chats") return json(201, { chat: { id: `chat-${this.nextId++}` } });
    if (method === "POST" && /\/members$/.test(path)) return json(201, {});
    if (method === "POST" && /\/attachments$/.test(path)) return json(201, { attachment: { id: `att-${this.nextId++}` } });
    if (method === "GET" && /\/stream$/.test(path)) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.flushHeaders();
      this.streams.add(res);
      res.on("close", () => this.streams.delete(res));
      return;
    }
    if (method === "POST" && /\/messages$/.test(path)) {
      const { content } = JSON.parse(body) as { content: string };
      const id = `msg-${this.nextId++}`;
      json(201, { message: { id } });
      setTimeout(() => this.play(`assistant-${id}`, this.reply(content, header("x-llm-api-key"))), 5);
      return;
    }
    json(404, { error: { code: "NOT_FOUND", message: path } });
  }

  private play(messageId: string, reply: FakeReply): void {
    this.publish("started", { type: "started", messageId });
    // Events of another message on the same stream must be ignored by the reader.
    this.publish("token", { type: "token", messageId: "someone-else", token: "NOISE" });
    if (reply.hang) return;
    for (const url of reply.fetchUrls ?? []) {
      this.publish("web_fetch", { type: "web_fetch", messageId, fetch: { id: url, url, status: "fetching" } });
      this.publish("web_fetch", { type: "web_fetch", messageId, fetch: { id: url, url, status: "done" } });
    }
    for (const url of reply.refusedUrls ?? []) {
      this.publish("web_fetch", { type: "web_fetch", messageId, fetch: { id: url, url, status: "fetching" } });
      this.publish("web_fetch", { type: "web_fetch", messageId, fetch: { id: url, url, status: "error", errorCode: "url_not_allowed" } });
    }
    for (const token of reply.tokens ?? []) this.publish("token", { type: "token", messageId, token });
    if (reply.error) this.publish("error", { type: "error", messageId, message: reply.error, retryable: false });
    else this.publish("done", { type: "done", messageId });
  }
}
