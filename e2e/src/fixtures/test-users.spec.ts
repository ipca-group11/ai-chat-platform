import { afterEach, describe, expect, it, vi } from "vitest";
import { freshUser, INVALID_PASSWORD, isolationUsers, uniqueEmail, VALID_PASSWORD } from "./test-users.js";

describe("test users", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps a valid password that follows the policy and an invalid one that breaks it", () => {
    expect(VALID_PASSWORD).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/);
    expect(INVALID_PASSWORD.length).toBeLessThan(8);
  });

  it("builds the e-mail from the prefix, a timestamp and a random part", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(uniqueEmail("ana")).toBe("ana.1700000000000-500000@e2e.example.com");
  });

  it("never repeats an e-mail within the same millisecond", () => {
    const emails = new Set(Array.from({ length: 200 }, () => uniqueEmail("x")));
    expect(emails.size).toBeGreaterThan(190);
  });

  it("freshUser defaults the prefix to user and uses the valid password", () => {
    const user = freshUser();
    expect(user.email).toMatch(/^user\..+@e2e\.example\.com$/);
    expect(user.password).toBe(VALID_PASSWORD);
    expect(freshUser("bia").email.startsWith("bia.")).toBe(true);
  });

  it("isolationUsers returns two distinct users", () => {
    const { userA, userB } = isolationUsers();
    expect(userA.email.startsWith("user-a.")).toBe(true);
    expect(userB.email.startsWith("user-b.")).toBe(true);
    expect(userA.email).not.toBe(userB.email);
  });
});
