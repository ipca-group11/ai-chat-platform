import { expect, test } from "@playwright/test";
import { loginUser, registerAndLogin, registerUser } from "../fixtures/auth-flows.js";
import { freshUser, INVALID_PASSWORD } from "../fixtures/test-users.js";

/** auth stories (docs/BACKLOG.json, pod `auth`). */

test.describe("auth", () => {
  test("US-10: User registration (FR1, UC1)", async ({ page }) => {
    const user = freshUser("register");

    await test.step("AC-30: the form collects email + password and validates client-side", async () => {
      await page.goto("/register");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    });

    await test.step("AC-32: an invalid password is rejected with a validation error", async () => {
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(INVALID_PASSWORD);
      await page.getByRole("button", { name: /create account|register/i }).click();
      await expect(page).toHaveURL(/\/register/);
      await expect(page.getByRole("alert")).toContainText(/password/i);
    });

    await test.step("AC-30/AC-34: a valid email + password registers, then can log in immediately", async () => {
      await registerUser(page, user);
      await loginUser(page, user);
    });

    await test.step("AC-31: a duplicate email is rejected server-side and no second account is created", async () => {
      await page.goto("/register");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: /create account|register/i }).click();
      await expect(page).toHaveURL(/\/register/);
      await expect(page.getByRole("alert")).toContainText(/already|exists|taken/i);
    });

    test.fixme(
      true,
      "AC-33 (passwords stored hashed in Postgres, never logged in plaintext) has no " +
        "client-observable signature: it is verified by auth-service's own unit/" +
        "integration tests against the Prisma schema and logger, not by the UI.",
    );
  });

  test("US-11: Login and logout (FR2, UC2)", async ({ page, context }) => {
    const user = freshUser("login");
    await registerUser(page, user);

    await test.step("AC-35: valid credentials log the user in and land them on their chat list", async () => {
      await loginUser(page, user);
      await expect(page).toHaveURL(/\/chats/);
    });

    await test.step("AC-37: the auth token is an httpOnly cookie, invisible to client JS", async () => {
      const cookies = await context.cookies();
      const authCookie = cookies.find((c) => /auth|session|token/i.test(c.name));
      expect(authCookie).toBeTruthy();
      expect(authCookie?.httpOnly).toBe(true);

      const visibleToJs = await page.evaluate(() => document.cookie);
      expect(visibleToJs).not.toMatch(/token|session/i);
    });

    await test.step("AC-38: logout invalidates the session for subsequent requests", async () => {
      await page.getByRole("button", { name: /log out|sign out/i }).click();
      await expect(page).toHaveURL(/\/login/);

      await page.goto("/chats");
      await expect(page).toHaveURL(/\/login/);
    });

    await test.step("AC-36: invalid credentials show one generic error, not field-specific", async () => {
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
      await page.getByRole("button", { name: /log in|sign in/i }).click();

      await expect(page).toHaveURL(/\/login/);
      const error = page.getByRole("alert");
      await expect(error).toBeVisible();
      await expect(error).not.toContainText(/email/i);
      await expect(error).not.toContainText(/password/i);
    });
  });

  test("US-12: Session validation on every protected request (FR3)", async ({ page, context, request }) => {
    await test.step("AC-39: conversation-service rejects a request with no token with 401", async () => {
      const response = await request.get("/api/chats");
      expect(response.status()).toBe(401);
    });

    await test.step("AC-39: conversation-service rejects a request with an invalid token with 401", async () => {
      const response = await request.get("/api/chats", {
        headers: { Cookie: "auth_token=not-a-real-token" },
      });
      expect(response.status()).toBe(401);
    });

    await test.step("AC-40/AC-41: a valid session (issued+validated by auth-service) lets the shell load /chats, and an expired/invalid one redirects to login", async () => {
      const user = freshUser("session");
      await registerAndLogin(page, user);
      await expect(page).toHaveURL(/\/chats/);

      await context.clearCookies();
      await page.goto("/chats");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
