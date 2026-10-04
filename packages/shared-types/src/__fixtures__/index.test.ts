import { describe, expect, it } from "vitest";
import { fixtures } from "./index";
import type { Fixture } from "./index";

const entries = Object.entries(fixtures) as Array<[string, Fixture]>;

describe("canonical DTO fixtures", () => {
  it.each(entries)("%s passes its schema", (_name, { schema, input }) => {
    expect(schema.safeParse(input).success).toBe(true);
  });

  it("covers every schema listed in README section 4.2", () => {
    expect(Object.keys(fixtures)).toEqual([
      "userProfile",
      "authResponse",
      "accessTokenClaims",
      "chat",
      "chatMember",
      "message",
      "attachment",
      "sseMessage",
      "sseQueued",
      "sseStarted",
      "sseToken",
      "sseReasoning",
      "sseWebFetch",
      "sseDone",
      "sseError",
      "errorResponse",
      "testConnectionResponse",
    ]);
  });
});
