import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakePage } from "../test-utils/fake-page.js";

const expectations: string[] = [];

vi.mock("@playwright/test", () => ({
  expect: (page: unknown) => ({
    toHaveURL: (pattern: RegExp) => {
      expectations.push(`toHaveURL(${pattern})`);
      return Promise.resolve();
    },
  }),
}));

const { loginUser, registerAndLogin, registerUser } = await import("./auth-flows.js");
const user = { email: "ana@e2e.example.com", password: "Test1234pass" };

describe("auth flows", () => {
  beforeEach(() => {
    expectations.length = 0;
  });

  it("registerUser fills the form on /register and waits for the login page", async () => {
    const { page, calls } = createFakePage();

    await registerUser(page, user);

    expect(calls).toEqual([
      'goto("/register")',
      'getByLabel("Email").fill("ana@e2e.example.com")',
      'getByLabel("Password", {"exact":true}).fill("Test1234pass")',
      'getByRole("button", {"name":"/create account|register/i"}).click()',
    ]);
    expect(expectations).toEqual(["toHaveURL(/\\/login/)"]);
  });

  it("registerUser submits through a create account or register button", async () => {
    const { page } = createFakePage();
    const seen: RegExp[] = [];
    const original = page.getByRole.bind(page);
    page.getByRole = ((role: string, options: { name: RegExp }) => {
      seen.push(options.name);
      return original(role, options);
    }) as typeof page.getByRole;

    await registerUser(page, user);

    expect(seen[0]?.test("Create account")).toBe(true);
    expect(seen[0]?.test("Register")).toBe(true);
    expect(seen[0]?.test("Cancel")).toBe(false);
  });

  it("loginUser fills the form on /login and waits for the chat list", async () => {
    const { page, calls } = createFakePage();

    await loginUser(page, user);

    expect(calls).toEqual([
      'goto("/login")',
      'getByLabel("Email").fill("ana@e2e.example.com")',
      'getByLabel("Password", {"exact":true}).fill("Test1234pass")',
      'getByRole("button", {"name":"/log in|sign in/i"}).click()',
    ]);
    expect(expectations).toEqual(["toHaveURL(/\\/chats/)"]);
  });

  it("registerAndLogin registers first, then logs in", async () => {
    const { page, calls } = createFakePage();

    await registerAndLogin(page, user);

    const gotos = calls.filter((c) => c.startsWith("goto"));
    expect(gotos).toEqual(['goto("/register")', 'goto("/login")']);
    expect(expectations).toEqual(["toHaveURL(/\\/login/)", "toHaveURL(/\\/chats/)"]);
  });
});
