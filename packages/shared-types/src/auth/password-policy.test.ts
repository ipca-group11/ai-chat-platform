import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, isValidPassword, passwordSchema } from "./password-policy";

describe("passwordSchema", () => {
  it("AC-8: accepts a password with 8+ chars, a letter and a number", () => {
    expect(passwordSchema.safeParse("abcd1234").success).toBe(true);
  });

  it("AC-8: rejects a password shorter than the minimum length", () => {
    const result = passwordSchema.safeParse("a1" + "b".repeat(PASSWORD_MIN_LENGTH - 3));
    expect(result.success).toBe(false);
  });

  it("AC-8: rejects a password with no letters", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("AC-8: rejects a password with no numbers", () => {
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
  });

  it("AC-8: isValidPassword mirrors passwordSchema.safeParse", () => {
    expect(isValidPassword("goodpass1")).toBe(true);
    expect(isValidPassword("bad")).toBe(false);
  });
});
