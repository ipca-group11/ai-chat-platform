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
  /** `refused`: the URL is outside the tool's domain list, so the result is a `url_not_allowed` error. */
  | { type: "web_fetch"; id: string; url: string; refused: boolean };

/** The `allowed_domains` / `blocked_domains` of the request's web fetch tool (AICHAT-242). */
export interface FetchDomains {
  allowed?: string[];
  blocked?: string[];
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase()) : undefined;

/** The domain lists of the web fetch tool in a Messages API request body; undefined when the request has no such tool. */
export function fetchDomainsOf(tools: unknown): FetchDomains | undefined {
  const tool = Array.isArray(tools)
    ? (tools.find((t) => typeof t === "object" && t !== null && (t as { name?: unknown }).name === "web_fetch") as
        | Record<string, unknown>
        | undefined)
    : undefined;
  return tool ? { allowed: strings(tool.allowed_domains), blocked: strings(tool.blocked_domains) } : undefined;
}

/** Like the API: a domain covers its subdomains; an allow-list wins over a block-list. */
export function isFetchAllowed(url: string, domains: FetchDomains): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const covers = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (domains.allowed) return domains.allowed.some(covers);
  if (domains.blocked) return !domains.blocked.some(covers);
  return true;
}

export interface AnthropicReply {
  blocks: Block[];
  stopReason: StopReason;
  outputTokens: number;
  /** The connection closes after the tokens, without closing events. */
  dropped: boolean;
  firstTokenDelayMs: number;
}

/**
 * The content blocks of a plan. When the request already ends with an assistant turn (the
 * caller resumes a paused turn) a pause-turn scenario answers with plain text.
 */
export function anthropicReply(plan: ScenarioPlan, seed: string, resumed: boolean, domains?: FetchDomains): AnthropicReply {
  const webFetch = (url: string): Block => ({ type: "web_fetch", id: "srvtoolu_mock0001", url, refused: !isFetchAllowed(url, domains ?? {}) });
  const full = generateTokens(seed, `${plan.name}/answer`, plan.tokens);
  const answer = plan.drop ? full.slice(0, Math.ceil(full.length / 2)) : full;
  const blocks: Block[] = [];
  let stopReason = plan.stopReason;
  if (plan.thinkingTokens > 0) {
    blocks.push({
      type: "thinking",
      tokens: generateTokens(seed, `${plan.name}/thinking`, plan.thinkingTokens),
      signature: "mock-signature",
    });
  }
  if (plan.scripted) {
    const words = plan.scripted.answer.split(/(?<=\s)/);
    // A scripted model only fetches when the request offers the web fetch tool, like a real one (AICHAT-242).
    if (plan.scripted.fetchUrl && domains) {
      blocks.push({ type: "text", tokens: [FETCH_INTRO] }, webFetch(plan.scripted.fetchUrl));
    }
    blocks.push({ type: "text", tokens: words });
  } else if (plan.webFetch && !resumed) {
    blocks.push({ type: "text", tokens: [FETCH_INTRO] }, webFetch(FETCH_URL));
    if (stopReason !== "pause_turn") blocks.push({ type: "text", tokens: answer });
  } else {
    if (stopReason === "pause_turn") stopReason = "end_turn";
    blocks.push({ type: "text", tokens: answer });
  }
  const outputTokens = blocks.reduce((sum, b) => sum + (b.type === "web_fetch" ? 12 : b.tokens.length), 0);
  return { blocks, stopReason, outputTokens, dropped: plan.drop, firstTokenDelayMs: plan.firstTokenDelayMs };
}

const fetchInput = (url: string): string => JSON.stringify({ url });
const fetchResult = (id: string, url: string, refused = false) => ({
  type: "web_fetch_tool_result",
  tool_use_id: id,
  content: refused ? { type: "web_fetch_tool_error", error_code: "url_not_allowed" } : {
    type: "web_fetch_result",
    url,
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
      { type: "server_tool_use", id: block.id, name: "web_fetch", input: { url: block.url } },
      fetchResult(block.id, block.url, block.refused),
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
  const pacer = new Pacer(config, reply.firstTokenDelayMs);
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
        delta: { type: "input_json_delta", partial_json: fetchInput(block.url) },
      });
      yield anthropicFrame("content_block_stop", { type: "content_block_stop", index });
      index++;
      yield anthropicFrame("content_block_start", {
        type: "content_block_start",
        index,
        content_block: fetchResult(block.id, block.url, block.refused),
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
    if (reply.dropped) return;
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
