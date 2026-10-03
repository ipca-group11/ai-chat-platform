import type { Rng } from "../prng.js";
import type { MockConfig } from "../config.js";
import { Pacer } from "./pacer.js";
import type { ScenarioPlan, StopReason } from "./scenarios.js";
import { generateTokens } from "./text.js";

const FETCH_URL = "https://example.com";
const FETCH_INTRO = "I will fetch the page. ";
const FETCH_PAGE = "This domain is for use in illustrative examples.";

type Block =
  | { type: "thinking"; tokens: string[]; signature: string }
  | { type: "text"; tokens: string[] }
  | { type: "web_fetch"; id: string };

export interface AnthropicReply {
  blocks: Block[];
  stopReason: StopReason;
  outputTokens: number;
}

/**
 * The content blocks of a plan. When the request already ends with an assistant turn (the
 * caller resumes a paused turn) a pause-turn scenario answers with plain text.
 */
export function anthropicReply(plan: ScenarioPlan, seed: string, resumed: boolean): AnthropicReply {
  const answer = generateTokens(seed, `${plan.name}/answer`, plan.tokens);
  const blocks: Block[] = [];
  let stopReason = plan.stopReason;
  if (plan.thinkingTokens > 0) {
    blocks.push({
      type: "thinking",
      tokens: generateTokens(seed, `${plan.name}/thinking`, plan.thinkingTokens),
      signature: "mock-signature",
    });
  }
  if (plan.webFetch && !resumed) {
    blocks.push({ type: "text", tokens: [FETCH_INTRO] }, { type: "web_fetch", id: "srvtoolu_mock0001" });
    if (stopReason !== "pause_turn") blocks.push({ type: "text", tokens: answer });
  } else {
    if (stopReason === "pause_turn") stopReason = "end_turn";
    blocks.push({ type: "text", tokens: answer });
  }
  const outputTokens = blocks.reduce((sum, b) => sum + (b.type === "web_fetch" ? 12 : b.tokens.length), 0);
  return { blocks, stopReason, outputTokens };
}

const fetchInput = JSON.stringify({ url: FETCH_URL });
const fetchResult = (id: string) => ({
  type: "web_fetch_tool_result",
  tool_use_id: id,
  content: {
    type: "web_fetch_result",
    url: FETCH_URL,
    retrieved_at: "1970-01-01T00:00:00Z",
    content: {
      type: "document",
      title: "Example Domain",
      source: { type: "text", media_type: "text/plain", data: FETCH_PAGE },
    },
  },
});

/** One Server-Sent Events frame in the Anthropic format. */
export const anthropicFrame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function messageId(rng: Rng): string {
  return `msg_mock${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}${rng.int(0, 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Non-streaming response of POST /v1/messages. */
export function anthropicMessage(reply: AnthropicReply, model: string, id: string) {
  const content = reply.blocks.flatMap((block): Array<Record<string, unknown>> => {
    if (block.type === "thinking") {
      return [{ type: "thinking", thinking: block.tokens.join(""), signature: block.signature }];
    }
    if (block.type === "text") return [{ type: "text", text: block.tokens.join("") }];
    return [
      { type: "server_tool_use", id: block.id, name: "web_fetch", input: { url: FETCH_URL } },
      fetchResult(block.id),
    ];
  });
  return {
    id,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: reply.stopReason,
    stop_sequence: null,
    usage: { input_tokens: 25, output_tokens: reply.outputTokens },
  };
}

export interface AnthropicStreamOptions {
  model: string;
  id: string;
  config: Pick<MockConfig, "ttftMs" | "tokenIntervalMs">;
  signal?: AbortSignal;
}

/** The SSE frames of a reply, in the order and shape of the real Messages API, paced like a model. */
export async function* anthropicStream(
  reply: AnthropicReply,
  { model, id, config, signal }: AnthropicStreamOptions,
): AsyncGenerator<string, void> {
  const pacer = new Pacer(config);
  yield anthropicFrame("message_start", {
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 25, output_tokens: 1 },
    },
  });

  let index = 0;
  for (const block of reply.blocks) {
    if (signal?.aborted) return;
    if (block.type === "web_fetch") {
      yield anthropicFrame("content_block_start", {
        type: "content_block_start",
        index,
        content_block: { type: "server_tool_use", id: block.id, name: "web_fetch", input: {} },
      });
      yield anthropicFrame("content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "input_json_delta", partial_json: fetchInput },
      });
      yield anthropicFrame("content_block_stop", { type: "content_block_stop", index });
      index++;
      yield anthropicFrame("content_block_start", {
        type: "content_block_start",
        index,
        content_block: fetchResult(block.id),
      });
      yield anthropicFrame("content_block_stop", { type: "content_block_stop", index });
      index++;
      continue;
    }

    const thinking = block.type === "thinking";
    yield anthropicFrame("content_block_start", {
      type: "content_block_start",
      index,
      content_block: thinking ? { type: "thinking", thinking: "", signature: "" } : { type: "text", text: "" },
    });
    if (index === 0) yield anthropicFrame("ping", { type: "ping" });
    for (const token of block.tokens) {
      if (signal?.aborted) return;
      await pacer.next();
      yield anthropicFrame("content_block_delta", {
        type: "content_block_delta",
        index,
        delta: thinking ? { type: "thinking_delta", thinking: token } : { type: "text_delta", text: token },
      });
    }
    if (block.type === "thinking") {
      yield anthropicFrame("content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "signature_delta", signature: block.signature },
      });
    }
    yield anthropicFrame("content_block_stop", { type: "content_block_stop", index });
    index++;
  }

  yield anthropicFrame("message_delta", {
    type: "message_delta",
    delta: { stop_reason: reply.stopReason, stop_sequence: null },
    usage: { output_tokens: reply.outputTokens },
  });
  yield anthropicFrame("message_stop", { type: "message_stop" });
}
