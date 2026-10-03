import { describe, expect, it } from "vitest";
import { createLogCapture, describePii, findPii, findPiiInLines } from "./pii";

const kinds = (text: string, options = {}) => findPii(text, options).map((m) => m.kind);

describe("findPii · email", () => {
  it("finds an address in free text and in JSON", () => {
    expect(findPii("sent to ana.silva+tag@pii-canary.example.com now")).toEqual([
      { kind: "email", value: "ana.silva+tag@pii-canary.example.com", index: 8 },
    ]);
    expect(kinds('{"owner":"bo@pii-canary.example.org"}')).toEqual(["email"]);
  });

  it("finds an address inside a percent-encoded URL", () => {
    expect(kinds("DELETE /chats/c1/members/ana%40pii-canary.example.com")).toEqual(["email"]);
  });

  it("ignores text that only looks close", () => {
    expect(findPii("user@localhost, a @ b, name@, [REDACTED]")).toEqual([]);
  });

  it("survives a malformed percent sequence", () => {
    expect(findPii("100% sure %E0%A4%A")).toEqual([]);
  });
});

describe("findPii · ip", () => {
  it("finds IPv4 and IPv6 addresses", () => {
    expect(kinds("from 203.0.113.7 port 5000")).toEqual(["ip"]);
    expect(kinds("remote ::ffff:10.0.0.1")).toContain("ip");
    expect(kinds("remote 2001:db8::8a2e:370:7334")).toEqual(["ip"]);
    expect(kinds("remote ::1")).toEqual(["ip"]);
    expect(kinds("remote 2001:0db8:0000:0000:0000:ff00:0042:8329")).toEqual(["ip"]);
  });

  it("ignores versions, timestamps and out-of-range octets", () => {
    expect(findPii("pino 10.3.1 build 1.2.3.4.5 at 12:30:45 value 999.1.1.1 code Foo::bar")).toEqual([]);
  });
});

describe("findPii · token", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl";

  it("finds a JWT, a bearer credential, a cookie value and an API key", () => {
    expect(kinds(jwt)).toEqual(["token"]);
    expect(kinds("authorization: Bearer abcdef123456")).toEqual(["token"]);
    expect(kinds("set-cookie: access_token=abc123def456; Path=/; HttpOnly")).toEqual(["token"]);
    expect(kinds("x-llm-api-key sk-ant-api03-AbCdEf123456")).toEqual(["token"]);
  });

  it("accepts the redaction placeholder and cleared cookies", () => {
    expect(findPii('"authorization":"Bearer [REDACTED]","cookie":"[REDACTED]"')).toEqual([]);
    expect(findPii("access_token=[REDACTED]; refresh_token=; Path=/")).toEqual([]);
    expect(findPii('"access_token=","session="')).toEqual([]);
  });
});

describe("findPii · canary and options", () => {
  it("finds a planted canary, with special characters handled literally", () => {
    expect(findPii("body PII-CANARY-7f3a.(x) end", { canaries: ["PII-CANARY-7f3a.(x)"] })).toEqual([
      { kind: "canary", value: "PII-CANARY-7f3a.(x)", index: 5 },
    ]);
    expect(findPii("nothing here", { canaries: ["PII-CANARY-7f3a", ""] })).toEqual([]);
  });

  it("reports each distinct match once, ordered by position", () => {
    const text = "b@pii-canary.example.com then a@pii-canary.example.com then b@pii-canary.example.com";
    expect(findPii(text).map((m) => m.value)).toEqual(["b@pii-canary.example.com", "a@pii-canary.example.com"]);
  });

  it("skips the kinds listed in ignore", () => {
    expect(kinds("a@pii-canary.example.com 203.0.113.7", { ignore: ["ip"] })).toEqual(["email"]);
  });
});

describe("findPiiInLines, describePii and createLogCapture", () => {
  it("names the line of each match", () => {
    const matches = findPiiInLines(["clean", "ip 203.0.113.7"]);
    expect(matches).toEqual([{ kind: "ip", value: "203.0.113.7", index: 3, line: 1 }]);
    expect(describePii(matches)).toBe('ip "203.0.113.7" on line 2');
    expect(describePii([{ kind: "canary", value: "x", index: 0 }])).toBe('canary "x"');
  });

  it("keeps what is written, line by line, and parses it", () => {
    const capture = createLogCapture();
    capture.write('{"a":1}\n{"b":2}\n');
    capture.write('{"c":3}\n');
    expect(capture.lines()).toHaveLength(3);
    expect(capture.records()).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    capture.clear();
    expect(capture.lines()).toEqual([]);
  });
});
