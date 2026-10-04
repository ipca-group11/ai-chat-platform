import { describe, expect, it } from "vitest";
import { authResponseSchema, deleteAccountRequestSchema, loginRequestSchema, registerRequestSchema } from "./dto";

describe("registerRequestSchema", () => {
  it("AC-8: accepts a valid email and policy-compliant password", () => {
    const result = registerRequestSchema.safeParse({
      email: "User@Example.com",
      password: "abcd1234",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("user@example.com");
  });

  it("AC-8: rejects an invalid email", () => {
    const result = registerRequestSchema.safeParse({
      email: "not-an-email",
      password: "abcd1234",
    });
    expect(result.success).toBe(false);
  });

  it("AC-8: rejects a password that fails the shared password policy", () => {
    const result = registerRequestSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginRequestSchema", () => {
  it("AC-8: accepts any non-empty password (policy is only enforced at registration)", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects an empty password", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("deleteAccountRequestSchema", () => {
  it("accepts the current password", () => {
    expect(deleteAccountRequestSchema.safeParse({ password: "x" }).success).toBe(true);
  });

  it("rejects a missing, empty or oversized password", () => {
    expect(deleteAccountRequestSchema.safeParse({}).success).toBe(false);
    expect(deleteAccountRequestSchema.safeParse({ password: "" }).success).toBe(false);
    expect(deleteAccountRequestSchema.safeParse({ password: "x".repeat(1025) }).success).toBe(false);
  });
});

describe("authResponseSchema", () => {
  it("AC-8: accepts a user profile without token fields", () => {
    const result = authResponseSchema.safeParse({
      user: { id: "u1", email: "user@example.com", createdAt: new Date().toISOString() },
    });
    expect(result.success).toBe(true);
  });
});
