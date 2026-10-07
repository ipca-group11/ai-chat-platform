import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireServiceToken } from "./service-token.js";

const TOKEN = "a-service-token-that-is-long-enough-123";

function run(authorization?: string) {
  const next = vi.fn();
  requireServiceToken(TOKEN)({ headers: { authorization } } as Request, {} as Response, next);
  return next;
}

describe("requireServiceToken", () => {
  it("lets the right token through", () => {
    expect(run(`Bearer ${TOKEN}`)).toHaveBeenCalledWith();
  });

  it.each([undefined, "", "Bearer ", "Bearer nope", `Bearer ${TOKEN}x`, `Bearer ${TOKEN.slice(1)}`, `Basic ${TOKEN}`, TOKEN])("answers 401 for %j", (header) => {
    const next = run(header);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });
});
