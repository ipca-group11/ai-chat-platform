import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page, type Request } from "@playwright/test";
import { countUsers, deleteUser, findPasswordHash } from "./support/db.js";

const authUrl = process.env["E2E_AUTH_URL"] ?? "http://localhost:4001";
const validPassword = "Passw0rd1";

function registerViaApi(request: APIRequestContext, email: string, password: string) {
  return request.post(`${authUrl}/auth/register`, { data: { email, password } });
}

/** Records the registration requests the page sends, for "no request is sent to the server". */
function trackRegisterRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/auth/register")) {
      requests.push(request);
    }
  });
  return requests;
}

async function submitRegistration(page: Page, email: string, password: string) {
  await test.step(`When I fill "Email" with "${email}"`, async () => {
    await page.getByTestId("email").fill(email);
  });
  await test.step(`And I fill "Password" with "${password}"`, async () => {
    await page.getByTestId("password").fill(password);
  });
  await test.step('And I click "Create account"', async () => {
    await page.getByTestId("create-account").click();
  });
}

async function expectStillOnRegistrationPage(page: Page) {
  await test.step("And I stay on the registration page", async () => {
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId("create-account")).toBeVisible();
  });
}

test.describe("User registration", () => {
  test.beforeEach(async ({ page, context }) => {
    await test.step("Given I am not logged in", async () => {
      await context.clearCookies();
    });
    await test.step('And I am on the registration page "/register"', async () => {
      await page.goto("/register");
      await expect(page.getByTestId("email")).toBeVisible();
      await expect(page.getByTestId("password")).toBeVisible();
    });
  });

  test("A new email and a valid password create an account (AC-30, AC-34)", async ({ page }) => {
    const email = `user-${randomUUID()}@example.com`;

    await submitRegistration(page, email, validPassword);

    await test.step('Then I am redirected to the login page "/login"', async () => {
      await expect(page).toHaveURL(/\/login$/);
    });
    await test.step(`And I can log in with "${email}" and "${validPassword}"`, async () => {
      await page.getByTestId("email").fill(email);
      await page.getByTestId("password").fill(validPassword);
      await page.getByTestId("sign-in").click();
      await expect(page).toHaveURL(/\/chats/);
    });
  });

  test("An already registered email is rejected (AC-31)", async ({ page, request }) => {
    await test.step('Given an account already exists for "existing@example.com"', async () => {
      const response = await registerViaApi(request, "existing@example.com", validPassword);
      expect([201, 409]).toContain(response.status());
    });

    await submitRegistration(page, "EXISTING@example.com", validPassword);

    await test.step('Then I see the error "An account with this email already exists"', async () => {
      await expect(page.getByTestId("register-error")).toHaveText("An account with this email already exists");
    });
    await expectStillOnRegistrationPage(page);
    await test.step("And no new account is created", () => {
      expect(countUsers("existing@example.com")).toBe(1);
    });
  });

  const invalidEmails = [
    { email: "", error: "Email is required" },
    { email: "not-an-email", error: "Enter a valid email address" },
  ];

  for (const { email, error } of invalidEmails) {
    test(`An invalid email is rejected before the request (AC-30): "${email}"`, async ({ page }) => {
      const registerRequests = trackRegisterRequests(page);

      await submitRegistration(page, email, validPassword);

      await test.step(`Then I see the error "${error}"`, async () => {
        await expect(page.getByTestId("email-error")).toHaveText(error);
      });
      await expectStillOnRegistrationPage(page);
      await test.step("And no request is sent to the server", () => {
        expect(registerRequests).toHaveLength(0);
      });
    });
  }

  const invalidPasswords = [
    { password: "Ab1", error: "Password must be at least 8 characters" },
    { password: "abcdefgh", error: "Password must contain at least one number" },
    { password: "12345678", error: "Password must contain at least one letter" },
  ];

  for (const { password, error } of invalidPasswords) {
    test(`A password that breaks the policy is rejected (AC-32): "${password}"`, async ({ page }) => {
      const registerRequests = trackRegisterRequests(page);

      await submitRegistration(page, "new.user@example.com", password);

      await test.step(`Then I see the error "${error}"`, async () => {
        await expect(page.getByTestId("password-error")).toHaveText(error);
      });
      await expectStillOnRegistrationPage(page);
      await test.step("And no request is sent to the server", () => {
        expect(registerRequests).toHaveLength(0);
      });
    });
  }

  test("The password is never stored in plain text (AC-33)", { tag: "@api" }, async ({ request }) => {
    const email = "hash.check@example.com";

    const response = await test.step(`Given I registered with "${email}" and "${validPassword}"`, async () => {
      // The database outlives a run: start without the account so the API answers 201 again.
      deleteUser(email);
      const registered = await registerViaApi(request, email, validPassword);
      expect(registered.status()).toBe(201);
      return registered;
    });

    const hash = await test.step("When I look up that user in the database", () => findPasswordHash(email));

    await test.step(`Then the stored password hash is not "${validPassword}"`, () => {
      expect(hash).not.toBeNull();
      expect(hash).not.toBe(validPassword);
    });
    await test.step("And the hash is a valid bcrypt hash", () => {
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    });
    await test.step("And the registration API response does not contain the password", async () => {
      expect(await response.json()).not.toHaveProperty("password");
      expect(await response.text()).not.toContain(validPassword);
    });
  });
});
