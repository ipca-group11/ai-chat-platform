import type { MockConfig } from "../config.js";
import type { Rng } from "../prng.js";
import { Pacer } from "./pacer.js";
import type { ScenarioPlan } from "./scenarios.js";
import { generateTokens } from "./text.js";

const CREATED = 1_700_000_000;
const FINGERPRINT = "fp_mock";

export type FinishReason = "stop" | "length";

export interface OpenAiReply {
  tokens: string[];
  finishReason: FinishReason;
  /** The connection closes after the tokens, without the finish chunk and `[DONE]`. */
  dropped: boolean;
  firstTokenDelayMs: number;
}

export function openAiReply(plan: ScenarioPlan, seed: string): OpenAiReply {
  const full = generateTokens(seed, `${plan.name}/answer`, plan.tokens);
  const tokens = plan.drop ? full.slice(0, Math.ceil(full.length / 2)) : full;
  return {
    tokens,
    dropped: plan.drop,
    firstTokenDelayMs: plan.firstTokenDelayMs,
    finishReason: plan.stopReason === "max_tokens" ? "length" : "stop",
  };
}

export function completionId(rng: Rng): string {
  return `chatcmpl-mock${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}`;
}

const PROMPT_TOKENS = 25;
const usageOf = (reply: OpenAiReply) => ({
  prompt_tokens: PROMPT_TOKENS,
  completion_tokens: reply.tokens.length,
  total_tokens: PROMPT_TOKENS + reply.tokens.length,
});

/** Non-streaming response of POST /v1/chat/completions. */
export function openAiCompletion(reply: OpenAiReply, model: string, id: string) {
  return {
    id,
    object: "chat.completion",
    created: CREATED,
    model,
    system_fingerprint: FINGERPRINT,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: reply.tokens.join(""), refusal: null },
        finish_reason: reply.finishReason,
      },
    ],
    usage: usageOf(reply),
  };
}

/** One `data:` line of the OpenAI stream. */
export const openAiFrame = (data: unknown): string => `data: ${JSON.stringify(data)}\n\n`;

export const OPENAI_DONE = "data: [DONE]\n\n";

export interface OpenAiStreamOptions {
  model: string;
  id: string;
  config: Pick<MockConfig, "ttftMs" | "tokenIntervalMs">;
  /** `stream_options.include_usage`: adds a last chunk with the token counts. */
  includeUsage?: boolean;
  signal?: AbortSignal;
}

/** The chunks of a reply: role chunk, one chunk per token, finish chunk, then `[DONE]`. */
export async function* openAiStream(
  reply: OpenAiReply,
  { model, id, config, includeUsage, signal }: OpenAiStreamOptions,
): AsyncGenerator<string, void> {
  const pacer = new Pacer(config, reply.firstTokenDelayMs);
  const chunk = (delta: object, finishReason: FinishReason | null) =>
    openAiFrame({
      id,
      object: "chat.completion.chunk",
      created: CREATED,
      model,
      system_fingerprint: FINGERPRINT,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    });

  let first = true;
  for (const token of reply.tokens) {
    if (signal?.aborted) return;
    await pacer.next();
    yield chunk(first ? { role: "assistant", content: token } : { content: token }, null);
    first = false;
  }
  if (reply.dropped) return;
  yield chunk({}, reply.finishReason);
  if (includeUsage) {
    yield openAiFrame({
      id,
      object: "chat.completion.chunk",
      created: CREATED,
      model,
      system_fingerprint: FINGERPRINT,
      choices: [],
      usage: usageOf(reply),
    });
  }
  yield OPENAI_DONE;
}
