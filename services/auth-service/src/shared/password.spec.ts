import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import { bcryptCost, burnPasswordCheck, hashPassword, PRODUCTION_BCRYPT_COST, TEST_BCRYPT_COST, verifyPassword } from "./password.js";

describe("password hashing (AICHAT-252)", () => {
  it("uses the real cost outside tests and the minimum cost in tests", () => {
    expect(bcryptCost("production")).toBe(12);
    expect(bcryptCost("development")).toBe(PRODUCTION_BCRYPT_COST);
    expect(bcryptCost("test")).toBe(TEST_BCRYPT_COST);
    expect(TEST_BCRYPT_COST).toBe(4);
  });

  it("hashes at the test cost while the suite runs, and the hash verifies", async () => {
    const hash = await hashPassword("password1");
    expect(bcrypt.getRounds(hash)).toBe(TEST_BCRYPT_COST);
    await expect(verifyPassword("password1", hash)).resolves.toBe(true);
    await expect(verifyPassword("password2", hash)).resolves.toBe(false);
  });

  it("the timing burn never matches, whatever the password", async () => {
    await expect(burnPasswordCheck("timing-equaliser-not-a-credential")).resolves.toBe(false);
    await expect(burnPasswordCheck("anything")).resolves.toBe(false);
  });
});
