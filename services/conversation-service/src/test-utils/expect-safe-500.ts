import { expect } from "vitest";
import type { Response } from "supertest";

export const LEAKY_ERROR_MESSAGE = "database exploded: secret-internal-detail";

/** Asserts the standard 500 body and that nothing of the underlying error leaks: no
 * message, no stack trace, no file paths. */
export function expectSafe500(res: Response): void {
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe("INTERNAL_ERROR");
  expect(Object.keys(res.body.error).sort()).toEqual(["code", "message"]);
  const text = JSON.stringify(res.body);
  expect(text).not.toContain("secret-internal-detail");
  expect(text).not.toMatch(/stack|\bat \S+ \(|node_modules|\.tsx?:\d+/i);
}
