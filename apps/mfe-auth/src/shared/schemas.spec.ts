import { describe, expect, it } from "vitest";
import { emailSchema, loginSchema, passwordSchema, registerSchema } from "./schemas";

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("emailSchema", () => {
  it("accepts a well-formed address", () => {
    expect(emailSchema.safeParse("ana@example.com").success).toBe(true);
  });

  it("rejects an empty value with the 'required' message", () => {
    expect(messagesOf(emailSchema.safeParse(""))).toContain("Email is required");
  });

  it("rejects a malformed address", () => {
    expect(messagesOf(emailSchema.safeParse("not-an-email"))).toEqual(["Enter a valid email address"]);
  });
});

describe("passwordSchema (STACK.md decision #4)", () => {
  it("accepts 8+ characters with a letter and a number", () => {
    expect(passwordSchema.safeParse("abcdef12").success).toBe(true);
  });

  it("accepts exactly 8 characters and rejects 7", () => {
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(true);
    expect(messagesOf(passwordSchema.safeParse("abcdef1"))).toContain("Password must be at least 8 characters");
  });

  it("requires a letter", () => {
    expect(messagesOf(passwordSchema.safeParse("12345678"))).toEqual(["Password must contain at least one letter"]);
  });

  it("requires a number", () => {
    expect(messagesOf(passwordSchema.safeParse("abcdefgh"))).toEqual(["Password must contain at least one number"]);
  });

  it("reports every broken rule at once", () => {
    expect(messagesOf(passwordSchema.safeParse(""))).toEqual([
      "Password must be at least 8 characters",
      "Password must contain at least one letter",
      "Password must contain at least one number",
    ]);
  });
});

describe("registerSchema", () => {
  it("accepts a valid email and password and keeps both values", () => {
    const input = { email: "ana@example.com", password: "s3cretpass" };
    expect(registerSchema.parse(input)).toEqual(input);
  });

  it("reports the failing field in the issue path", () => {
    const result = registerSchema.safeParse({ email: "bad", password: "short" });
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(result.success).toBe(false);
    expect(paths).toContain("email");
    expect(paths).toContain("password");
  });

  it("rejects missing fields", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
  });
});

describe("loginSchema (AC-36: the server decides if credentials are right)", () => {
  it("accepts any non-empty email and password, without applying the register policy", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(true);
  });

  it("requires both fields", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(messagesOf(result)).toEqual(["Email is required", "Password is required"]);
  });
});
