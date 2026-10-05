import { test, expect, type Page, type Request } from "@playwright/test";
import { deleteUser } from "./support/db.js";

const authUrl = process.env["E2E_AUTH_URL"] ?? "http://localhost:4001";
const accountEmail = "tester@example.com";
const accountPassword = "Passw0rd1";

/** Records the login requests the page sends, for 'no request is sent to "/auth/login"'. */
function trackLoginRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/auth/login")) {
      requests.push(request);
    }
  });
  return requests;
}

async function submitLogin(page: Page, email: string, password: string) {
  await test.step(`When I enter "${email}" in "Email"`, async () => {
    await page.getByTestId("email").fill(email);
  });
  await test.step(`And I enter "${password}" in "Password"`, async () => {
    await page.getByTestId("password").fill(password);
  });
  await test.step('And I click "Sign in"', async () => {
    await page.getByTestId("sign-in").click();
  });
}

async function expectStillOnLoginPage(page: Page) {
  await test.step('And I stay on the "/login" page', async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("sign-in")).toBeVisible();
  });
}

test.describe("Login", () => {
  test.beforeEach(async ({ page, context, request }) => {
    await test.step(`Given an account exists with email "${accountEmail}" and password "${accountPassword}"`, async () => {
      // The database outlives a run and the scenarios depend on the password: start without the account.
      deleteUser(accountEmail);
      const registered = await request.post(`${authUrl}/auth/register`, {
        data: { email: accountEmail, password: accountPassword },
      });
      expect(registered.status()).toBe(201);
    });
    await test.step("And I am not signed in", async () => {
      await context.clearCookies();
    });
    await test.step('And I am on the "/login" page showing the "Sign in" card', async () => {
      await page.goto("/login");
      await expect(page.getByTestId("auth-card-title")).toHaveText("Sign in");
    });
  });

  test("Valid credentials open the chat list (AC-35)", async ({ page }) => {
    await submitLogin(page, "tester@example.com", "Passw0rd1");

    await test.step('Then I am on the "/chats" page', async () => {
      await expect(page).toHaveURL(/\/chats$/);
    });
    await test.step('And I see the heading "Chats"', async () => {
      await expect(page.getByTestId("chats-heading")).toHaveText("Chats");
    });
  });

  test("Email is matched regardless of letter case", async ({ page }) => {
    await submitLogin(page, "TESTER@Example.com", "Passw0rd1");

    await test.step('Then I am on the "/chats" page', async () => {
      await expect(page).toHaveURL(/\/chats$/);
    });
  });

  const invalidCredentials = [
    { name: "unknown email", email: "nobody@example.com", password: "Passw0rd1" },
    { name: "wrong password", email: "tester@example.com", password: "Wrong0pass" },
    { name: "malformed email", email: "not-an-email", password: "Passw0rd1" },
  ];

  for (const { name, email, password } of invalidCredentials) {
    test(`Invalid credentials show one generic error (AC-36): ${name}`, async ({ page }) => {
      await submitLogin(page, email, password);

      await test.step('Then I see the error "Invalid email or password"', async () => {
        await expect(page.getByTestId("login-error")).toHaveText("Invalid email or password");
      });
      await test.step("And I see no other error message", async () => {
        await expect(page.getByTestId(/-error$/)).toHaveCount(1);
      });
      await expectStillOnLoginPage(page);
    });
  }

  const emptyFields = [
    { email: "", password: "Passw0rd1", message: "Email is required" },
    { email: "tester@example.com", password: "", message: "Password is required" },
    { email: "", password: "", message: "Email is required" },
  ];

  for (const { email, password, message } of emptyFields) {
    test(`An empty field blocks the sign-in: email "${email}", password "${password}"`, async ({ page }) => {
      const loginRequests = trackLoginRequests(page);

      await submitLogin(page, email, password);

      await test.step(`Then I see the error "${message}"`, async () => {
        await expect(page.getByTestId("login-error")).toHaveText(message);
      });
      await expectStillOnLoginPage(page);
      await test.step('And no request is sent to "/auth/login"', () => {
        expect(loginRequests).toHaveLength(0);
      });
    });
  }
});
