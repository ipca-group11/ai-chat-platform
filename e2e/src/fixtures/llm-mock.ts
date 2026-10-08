import { expect, type APIRequestContext } from "@playwright/test";

/**
 * The LLM mock (AICHAT-144) logs every request conversation-service sends to "Anthropic" or "OpenAI".
 * Each entry says whether the provider sent the whole answer (`finishedAt`) or whether conversation-service
 * closed the connection first (`clientClosedAt`, AICHAT-201): what a Stop must cause upstream.
 */
const MOCK_URL = process.env["MOCK_SERVER_URL"] ?? `http://127.0.0.1:${process.env["MOCK_SERVER_PORT"] ?? "4010"}`;

export interface LlmRequest {
  id: number;
  path: string;
  body: { messages?: Array<{ role: string; content: unknown }> };
  finishedAt: string | null;
  clientClosedAt: string | null;
}

function lastUserText(entry: LlmRequest): string {
  const last = [...(entry.body?.messages ?? [])].reverse().find((m) => m.role === "user");
  if (!last) return "";
  if (typeof last.content === "string") return last.content;
  // Anthropic content blocks: [{ type: "text", text }]
  return (last.content as Array<{ text?: string }>).map((b) => b.text ?? "").join("");
}

/** The provider request conversation-service made for the user message `prompt` (prompts are unique per test). */
export async function llmRequestFor(request: APIRequestContext, prompt: string, mock: "anthropic" | "openai" = "anthropic"): Promise<LlmRequest | undefined> {
  const res = await request.get(`${MOCK_URL}/__admin/requests?mock=${mock}`);
  expect(res.ok(), "the LLM mock admin API must be reachable (pnpm mock:up)").toBe(true);
  const { requests } = (await res.json()) as { requests: LlmRequest[] };
  return requests.filter((r) => lastUserText(r).includes(prompt)).at(-1);
}

/** Waits until the provider request for `prompt` matches `ok`, then returns it. */
export async function waitForLlmRequest(
  request: APIRequestContext,
  prompt: string,
  ok: (entry: LlmRequest) => boolean,
  timeoutMs = 5_000,
): Promise<LlmRequest> {
  let entry: LlmRequest | undefined;
  await expect
    .poll(async () => {
      entry = await llmRequestFor(request, prompt);
      return entry !== undefined && ok(entry);
    }, { timeout: timeoutMs })
    .toBe(true);
  return entry as LlmRequest;
}
