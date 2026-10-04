import { describe, expect, it } from "vitest";
import { loginSchema as sharedLoginSchema } from "../../shared/schemas";
import { loginSchema } from "./model";

describe("login model", () => {
  it("exposes the shared login schema, so form and API agree on one definition", () => {
    expect(loginSchema).toBe(sharedLoginSchema);
  });

  it("validates credentials the way the login form needs", () => {
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "pw" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(false);
  });
});
