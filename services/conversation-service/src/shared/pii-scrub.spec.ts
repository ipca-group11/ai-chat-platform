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

describe("serializeError of library errors that echo values (AICHAT-234)", () => {
  /** A Prisma error as the client raises it: the message prints the query with its values. */
  function prismaError(name: string, code?: string): Error {
    const err = new Error("\nInvalid `prisma.message.create()` invocation:\n{ data: { content: \"my secret diary entry\" } }\nUnique constraint failed");
    err.name = name;
    return Object.assign(err, code ? { code, clientVersion: "6.1.0" } : { clientVersion: "6.1.0" });
  }

  it("replaces a Prisma message by a fixed text that keeps only the error code", () => {
    const out = serializeError(prismaError("PrismaClientKnownRequestError", "P2002"));
    expect(out.message).toBe("Database request failed (P2002: unique constraint failed)");
    expect(JSON.stringify(out)).not.toContain("secret diary");
    expect(out.stack?.split("\n")[0]).toBe("PrismaClientKnownRequestError: Database request failed (P2002: unique constraint failed)");
    expect(out.stack).toMatch(/\n\s+at /);
    expect(serializeError(prismaError("PrismaClientKnownRequestError", "P2034")).message).toBe("Database request failed (P2034)");
  });

  it.each([
    ["PrismaClientValidationError", "Invalid database query"],
    ["PrismaClientUnknownRequestError", "Database request failed with an unknown error"],
    ["PrismaClientInitializationError", "Database client could not start"],
    ["PrismaClientRustPanicError", "Database engine crashed"],
  ])("maps %s to a fixed message", (name, message) => {
    const out = serializeError(prismaError(name));
    expect(out).toMatchObject({ type: name, message });
    expect(JSON.stringify(out)).not.toContain("secret diary");
  });

  it("recognises a Prisma error by its class name too", () => {
    class PrismaClientKnownRequestError extends Error {
      code = "P2025";
    }
    const err = new PrismaClientKnownRequestError("No record for content 'my secret diary entry'");
    expect(serializeError(err).message).toBe("Database request failed (P2025: record not found)");
  });

  it("does not trust a code that could itself hold a value", () => {
    const err = Object.assign(prismaError("PrismaClientKnownRequestError"), { code: "my secret diary entry" });
    expect(serializeError(err).message).toBe("Database request failed");
  });

  it("replaces a body-parser message, which quotes the start of the body", () => {
    const err = Object.assign(new SyntaxError(`Unexpected token 'm', "my secret diary entry" is not valid JSON`), {
      type: "entity.parse.failed",
      body: "my secret diary entry",
      status: 400,
    });
    const out = serializeError(err);
    expect(out).toMatchObject({ type: "SyntaxError", message: "Request body could not be read (entity.parse.failed)" });
    expect(JSON.stringify(out)).not.toContain("secret diary");
  });

  it("replaces a Node system error message, which holds the path", () => {
    const err = Object.assign(new Error("ENOENT: no such file or directory, open '/data/uploads/my secret diary entry.txt'"), {
      code: "ENOENT",
      syscall: "open",
      path: "/data/uploads/my secret diary entry.txt",
    });
    const out = serializeError(err);
    expect(out.message).toBe("System call open failed (ENOENT)");
    expect(JSON.stringify(out)).not.toContain("secret diary");
  });

  it("reads the error out of the object pino-http passes to a custom serializer", () => {
    const err = prismaError("PrismaClientKnownRequestError", "P2002");
    expect(serializeError({ type: "Error", message: err.message, raw: err })).toMatchObject({
      type: "PrismaClientKnownRequestError",
      message: "Database request failed (P2002: unique constraint failed)",
    });
  });

  it("keeps the scrubbed message of every other error, and a mapped error without a stack has none", () => {
    expect(serializeError(new Error("No LLM provider adapter registered")).message).toBe("No LLM provider adapter registered");
    const bare = prismaError("PrismaClientValidationError");
    bare.stack = undefined;
    expect(serializeError(bare)).toEqual({ type: "PrismaClientValidationError", message: "Invalid database query" });
  });
});
