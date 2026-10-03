import { describe, expect, it } from "vitest";
import { readLines, readSseData } from "./http-stream.js";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe("readLines", () => {
  it("AC-52: yields a trailing line even without a final newline", async () => {
    const lines = await collect(readLines(streamOf(["line-one\nline-two"])));
    expect(lines).toEqual(["line-one", "line-two"]);
  });

  it("returns nothing for a null body", async () => {
    const lines = await collect(readLines(null));
    expect(lines).toEqual([]);
  });

  it("skips blank lines", async () => {
    const lines = await collect(readLines(streamOf(["a\n\n\nb\n"])));
    expect(lines).toEqual(["a", "b"]);
  });
});

describe("readSseData", () => {
  it("AC-52: extracts data payloads and stops at [DONE]", async () => {
    const data = await collect(readSseData(streamOf(["data: one\n\n", "data: two\n\n", "data: [DONE]\n\n", "data: three\n\n"])));
    expect(data).toEqual(["one", "two"]);
  });

  it("ignores non-data lines", async () => {
    const data = await collect(readSseData(streamOf([": comment\n", "event: ping\n", "data: hi\n"])));
    expect(data).toEqual(["hi"]);
  });
});
