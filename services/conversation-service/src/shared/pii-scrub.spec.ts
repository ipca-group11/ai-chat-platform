import { describe, expect, it } from "vitest";
import { DROPPED, scrubText, scrubUrl, serializeError } from "./pii-scrub.js";

describe("scrubText", () => {
  it("drops emails, IPv4, IPv6 and JWTs", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl";
    expect(scrubText(`a ana@pii-canary.example.com b 203.0.113.7 c 2001:db8::1 d ${jwt}`)).toBe(
      `a ${DROPPED} b ${DROPPED} c ${DROPPED} d ${DROPPED}`,
    );
  });

  it("leaves other text alone", () => {
    expect(scrubText("pino 10.3.1 at 12:30:45 failed")).toBe("pino 10.3.1 at 12:30:45 failed");
  });
});

describe("scrubUrl", () => {
  it("drops the query string and the fragment", () => {
    expect(scrubUrl("/auth/me?email=ana@pii-canary.example.com&x=1#top")).toBe("/auth/me");
  });

  it("masks an email in the path, plain or percent-encoded", () => {
    expect(scrubUrl("/chats/c1/members/ana@pii-canary.example.com")).toBe(`/chats/c1/members/${DROPPED}`);
    expect(scrubUrl("/chats/c1/members/ana%40pii-canary.example.com")).toBe(`/chats/c1/members/${DROPPED}`);
  });

  it("keeps a path without PII as it is, even when it is not valid percent-encoding", () => {
    expect(scrubUrl("/chats/c1/messages")).toBe("/chats/c1/messages");
    expect(scrubUrl("/x/100%")).toBe("/x/100%");
    expect(scrubUrl("")).toBe("");
  });
});

describe("serializeError", () => {
  it("keeps the type, a scrubbed message and stack, and nothing else", () => {
    const err = Object.assign(new Error("failed for ana@pii-canary.example.com"), { body: "secret body", filename: "x.txt" });
    const out = serializeError(err);
    expect(out.type).toBe("Error");
    expect(out.message).toBe(`failed for ${DROPPED}`);
    expect(out.stack).not.toContain("pii-canary");
    expect(Object.keys(out).sort()).toEqual(["message", "stack", "type"]);
  });

  it("copes with an error without a stack and with values that are not errors", () => {
    const bare = new Error("x");
    bare.stack = undefined;
    expect(serializeError(bare)).toEqual({ type: "Error", message: "x" });
    expect(serializeError("boom 203.0.113.7")).toEqual({ type: "string", message: `boom ${DROPPED}` });
  });
});
