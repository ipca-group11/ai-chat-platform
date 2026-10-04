// A Docker-free stack for the prompt injection harness (AICHAT-26): the REAL conversation-service app (routes,
// queue, message processor, Anthropic adapter, SYSTEM_PROMPT) behind one port like the shell, talking to the LLM mock
// (testing/mock-server). Only the database and auth-service are replaced: repositories are in memory (the fakes of the
// service's own tests) and a small stand-in signs the access-token cookie. Use it when the compose stack cannot be built.
//
//   services/conversation-service/node_modules/.bin/tsx testing/promptfoo/stack/local-stack.ts
//
// Variables: LOCAL_STACK_PORT (default 8000), LOCAL_STACK_MOCK_PORT (default 4010).
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createApp } from "../../../services/conversation-service/src/app.ts";
import { createProviderRegistry } from "../../../services/conversation-service/src/features/llm-adapters/index.ts";
import { ChatEventBus } from "../../../services/conversation-service/src/features/streaming/index.ts";
import { parseEnv } from "../../../services/conversation-service/src/shared/env.ts";
import { createLogger } from "../../../services/conversation-service/src/shared/logger.ts";
import type { PrismaClient } from "../../../services/conversation-service/src/shared/prisma.ts";
import { FakeAttachmentsRepository } from "../../../services/conversation-service/src/test-utils/fake-attachments-repository.ts";
import { FakeChatsRepository } from "../../../services/conversation-service/src/test-utils/fake-chats-repository.ts";
import { FakeMessagesRepository } from "../../../services/conversation-service/src/test-utils/fake-messages-repository.ts";
import { FakeStorage } from "../../../services/conversation-service/src/test-utils/fake-storage.ts";
import { createApp as createMockApp } from "../../mock-server/src/app.ts";
import { loadConfig } from "../../mock-server/src/config.ts";
import { TEST_SYSTEM_PROMPT } from "../src/canary.ts";

const port = Number(process.env["LOCAL_STACK_PORT"] ?? 8000);
const mockPort = Number(process.env["LOCAL_STACK_MOCK_PORT"] ?? 4010);
// Signs the cookies of this throw-away stack only; it is not a credential of any real system.
const secret = `local-stack-${process.pid}-${Date.now()}`;

const b64 = (value: object | Buffer): string => Buffer.from(value instanceof Buffer ? value : JSON.stringify(value)).toString("base64url");
function signToken(sub: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email, iat: now, exp: now + 3600 })}`;
  return `${head}.${b64(createHmac("sha256", secret).update(head).digest())}`;
}

const mock = createMockApp(loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "20" })).app;
await new Promise<void>((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const env = parseEnv({
  JWT_SECRET: secret,
  LOG_LEVEL: "silent",
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${mockPort}/anthropic`,
  SYSTEM_PROMPT: TEST_SYSTEM_PROMPT,
});
const conversation = createApp({} as PrismaClient, env, createLogger("silent"), {
  chatsRepo: new FakeChatsRepository(),
  messagesRepo: new FakeMessagesRepository(),
  attachmentsRepo: new FakeAttachmentsRepository(),
  storage: new FakeStorage(),
  providerRegistry: createProviderRegistry({ ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL } as NodeJS.ProcessEnv),
  bus: new ChatEventBus(),
});

const users = new Map<string, string>();

async function readBody(req: IncomingMessage): Promise<{ email?: string; password?: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { email?: string; password?: string };
  } catch {
    return {};
  }
}

async function auth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  const email = (body.email ?? "").toLowerCase();
  const json = (status: number, payload: object, headers: Record<string, string> = {}): void => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(payload));
  };
  if (req.url === "/auth/register") {
    if (users.has(email)) return json(409, { error: { code: "EMAIL_TAKEN", message: "taken" } });
    users.set(email, body.password ?? "");
    return json(201, {});
  }
  if (req.url === "/auth/login") {
    if (!users.has(email) || users.get(email) !== body.password) return json(401, { error: { code: "INVALID_CREDENTIALS", message: "no" } });
    return json(200, {}, { "Set-Cookie": `access_token=${signToken(`user-${email}`, email)}; Path=/; HttpOnly` });
  }
  json(404, { error: { code: "NOT_FOUND", message: req.url ?? "" } });
}

createServer((req, res) => {
  if (req.url?.startsWith("/auth/")) void auth(req, res);
  else if (req.url?.startsWith("/api/")) {
    req.url = req.url.slice("/api".length);
    conversation(req, res);
  } else res.writeHead(200, { "Content-Type": "text/plain" }).end("local red-team stack");
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`local stack on http://127.0.0.1:${port} (LLM mock on ${mockPort})\n`);
});
