import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../features/llm-adapters/anthropic.provider.js";
import { readSseData } from "../features/llm-adapters/http-stream.js";
import { replayFetch, responseFromChunks, splitAtOffsets, splitBytes } from "./replay.js";

const encode = (text: string) => new TextEncoder().encode(text);
const collect = async (response: Response) => {
  const out: string[] = [];
  for await (const data of readSseData(response.body)) out.push(data);
  return out;
};

describe("splitBytes", () => {
  it("cuts into uneven chunks that cycle through the sizes and rejoin to the same bytes", () => {
    const bytes = encode("abcdefghijklmnopqrstuvwxyz");
    const chunks = splitBytes(bytes, [1, 7, 3]);
    expect(chunks.map((c) => c.length)).toEqual([1, 7, 3, 1, 7, 3, 1, 3]);
    expect(Buffer.concat(chunks).toString()).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("rejects empty or non-positive sizes", () => {
    expect(() => splitBytes(encode("x"), [])).toThrow("positive integers");
    expect(() => splitBytes(encode("x"), [0])).toThrow("positive integers");
  });
});

describe("splitAtOffsets", () => {
  it("cuts at the given offsets and skips empty pieces", () => {
    const chunks = splitAtOffsets(encode("abcdef"), [2, 2, 4]);
    expect(chunks.map((c) => Buffer.from(c).toString())).toEqual(["ab", "cd", "ef"]);
  });

  it("rejects offsets outside the body", () => {
    expect(() => splitAtOffsets(encode("abc"), [9])).toThrow("offsets must be ascending");
  });
});

describe("UTF-8 split across chunks", () => {
  const line = `data: ${JSON.stringify({ text: "café 世界 😀" })}\n\n`;
  const bytes = encode(line);

  it("decodes the text intact when the cut falls on every possible byte offset", async () => {
    for (let offset = 1; offset < bytes.length; offset++) {
      const response = responseFromChunks(splitAtOffsets(bytes, [offset]));
      expect(await collect(response), `cut at byte ${offset}`).toEqual([JSON.stringify({ text: "café 世界 😀" })]);
    }
  });

  it("decodes the text intact when the body arrives one byte at a time", async () => {
    const response = responseFromChunks(splitBytes(bytes, [1]));
    expect(await collect(response)).toEqual([JSON.stringify({ text: "café 世界 😀" })]);
  });

  it("streams multi-byte text through the Anthropic adapter when a character is split", async () => {
    const event = `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "olá 😀" } })}\n\n`;
    const body = encode(`${event}event: message_stop\ndata: {"type":"message_stop"}\n\n`);
    const emoji = body.indexOf(0xf0);
    const { fetch } = replayFetch(responseFromChunks(splitAtOffsets(body, [emoji + 2])));
    const provider = new AnthropicProvider({ fetchImpl: fetch });
    const chunks: unknown[] = [];
    for await (const chunk of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "claude-3-5-sonnet", apiKey: "k" })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["olá 😀"]);
  });
});

describe("replayFetch", () => {
  it("answers in order, records the parsed request bodies and fails when it runs out", async () => {
    const replay = replayFetch(new Response("one"), new Response("two"));
    const first = await replay.fetch("https://example.test/a", { method: "POST", body: JSON.stringify({ n: 1 }) });
    const second = await replay.fetch(new URL("https://example.test/b"), { method: "POST", body: JSON.stringify({ n: 2 }) });
    expect([await first.text(), await second.text()]).toEqual(["one", "two"]);
    expect(replay.requests.map((r) => [r.url, r.body])).toEqual([
      ["https://example.test/a", { n: 1 }],
      ["https://example.test/b", { n: 2 }],
    ]);
    await expect(replay.fetch("https://example.test/c")).rejects.toThrow("no response left for request 3");
  });
});
