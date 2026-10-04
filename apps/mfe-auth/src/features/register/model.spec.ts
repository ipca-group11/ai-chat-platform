import { describe, expect, it } from "vitest";
import { registerSchema as sharedRegisterSchema } from "../../shared/schemas";
import { registerSchema } from "./model";

describe("register model", () => {
  it("exposes the shared register schema, so form and API agree on one definition", () => {
    expect(registerSchema).toBe(sharedRegisterSchema);
  });

  it("enforces the password policy", () => {
    expect(registerSchema.safeParse({ email: "ana@example.com", password: "s3cretpass" }).success).toBe(true);
    expect(registerSchema.safeParse({ email: "ana@example.com", password: "onlyletters" }).success).toBe(false);
  });
});
