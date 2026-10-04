import { describe, expect, it } from "vitest";
import { SseParser } from "./sse.ts";

describe("SseParser", () => {
  it("returns a complete frame with its JSON data", () => {
    expect(new SseParser().push('event: token\ndata: {"token":"Hi"}\n\n')).toEqual([{ event: "token", data: { token: "Hi" } }]);
  });

  it("keeps a partial frame until the rest arrives, also when it is split inside a line", () => {
    const parser = new SseParser();
    expect(parser.push('event: tok')).toEqual([]);
    expect(parser.push('en\ndata: {"a":1}\n')).toEqual([]);
    expect(parser.push("\nevent: done\ndata: {}\n\n")).toEqual([
      { event: "token", data: { a: 1 } },
      { event: "done", data: {} },
    ]);
  });

  it("accepts CRLF, skips comments and frames without data, and keeps non-JSON data as text", () => {
    const frames = new SseParser().push(": keep-alive\n\nevent: x\r\ndata: plain\r\n\r\ndata: {\"n\":2}\n\n");
    expect(frames).toEqual([
      { event: "x", data: "plain" },
      { event: "message", data: { n: 2 } },
    ]);
  });
});
