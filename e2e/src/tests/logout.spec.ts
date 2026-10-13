import { test, expect, type APIResponse, type Page } from "@playwright/test";
import { authUrl, registerAccount, uniqueAccount, type Account } from "./support/auth.js";

interface ErrorResponse {
  error: { code: string; message: string };
}

/** The `Set-Cookie` headers of a response. */
function setCookieHeaders(response: APIResponse): string[] {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value);
}

/** A `Set-Cookie` header that removes the cookie (empty value, expired in 1970). */
function clearedCookie(name: string): RegExp {
  return new RegExp(`^${name}=;.*Expires=Thu, 01 Jan 1970`, "i");
}

async function cookieValue(page: Page, name: string): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name)?.value;
}

function logOutViaApi(page: Page) {
  return page.request.post(`${authUrl}/auth/logout`);
}

async function clickLogOut(page: Page, keyword: string) {
  await test.step(`${keyword} I click "Log out"`, async () => {
    await page.getByTestId("log-out").click();
  });
}

async function expectOnLoginPage(page: Page, line: string) {
  await test.step(line, async () => {
    // The route guard may add `?redirect=` to the login URL.
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByTestId("auth-card-title")).toBeVisible();
  });
}

async function expectStatus(response: APIResponse, status: number) {
  await test.step(`Then the response status is ${status}`, () => {
    expect(response.status()).toBe(status);
  });
}

async function expectErrorMessage(response: APIResponse, message: string) {
  await test.step(`And the error message is "${message}"`, async () => {
    const body = (await response.json()) as ErrorResponse;
    expect(body.error.message).toBe(message);
  });
}

test.describe("Logout", () => {
  let account: Account;

  test.beforeEach(async ({ page }) => {
    await test.step("Given a registered user exists", async () => {
      account = uniqueAccount("logout");
      const registered = await registerAccount(page, account);
      expect(registered.status()).toBe(201);
    });
    await test.step("And I am signed in as that user", async () => {
      // `page.request` shares the browser's cookie jar, so the page is signed in too.
      const loggedIn = await page.request.post(`${authUrl}/auth/login`, { data: account });
      expect(loggedIn.status()).toBe(200);
    });
    await test.step('And I am on the "/chats" page', async () => {
      await page.goto("/chats");
      await expect(page.getByTestId("chats-heading")).toHaveText("Chats");
    });
  });

  test("User logs out from the navigation bar (AC-38)", async ({ page }) => {
    await clickLogOut(page, "When");
    await expectOnLoginPage(page, 'Then I am on the "/login" page');
    await test.step('And I see the heading "Sign in"', async () => {
      await expect(page.getByTestId("auth-card-title")).toHaveText("Sign in");
    });
    await test.step('And the navigation bar no longer shows my email, "Chats", "Settings" or "Log out"', async () => {
      for (const id of ["nav-user-email", "nav-chats", "nav-settings", "log-out"]) {
        await expect(page.getByTestId(id)).toHaveCount(0);
      }
    });
  });

  const protectedPages = [
    { page: "/chats", content: "chats-heading" },
    { page: "/settings", content: "settings-heading" },
  ];

  for (const row of protectedPages) {
    test(`Protected pages are not reachable after logout (AC-38): ${row.page}`, async ({ page }) => {
      await test.step('Given I have clicked "Log out"', async () => {
        await page.getByTestId("log-out").click();
        await expect(page).toHaveURL(/\/login(\?|$)/);
      });
      await test.step(`When I open "${row.page}"`, async () => {
        await page.goto(row.page);
      });
      await expectOnLoginPage(page, 'Then I am redirected to the "/login" page');
      await test.step(`And I do not see the content of "${row.page}"`, async () => {
        await expect(page.getByTestId(row.content)).toHaveCount(0);
      });
    });
  }

  test("Logout still leaves the app when the request fails", async ({ page }) => {
    await test.step('Given the request POST "/auth/logout" is blocked in the browser', async () => {
      await page.route("**/auth/logout", (route) => route.abort());
    });
    await clickLogOut(page, "When");
    await expectOnLoginPage(page, 'Then I am on the "/login" page');
    await test.step("And no error message is shown", async () => {
      await expect(page.getByTestId(/-error$/)).toHaveCount(0);
    });
  });

  test("Logout clears both auth cookies (AC-38)", { tag: "@api" }, async ({ page }) => {
    const response = await test.step('When I send POST "/auth/logout" with my session cookies', () => logOutViaApi(page));
    await expectStatus(response, 204);
    for (const name of ["access_token", "refresh_token"]) {
      await test.step(`And the response clears the "${name}" cookie`, () => {
        expect(setCookieHeaders(response)).toContainEqual(expect.stringMatching(clearedCookie(name)));
      });
    }
  });

  test("Refresh token is rejected after logout (AC-38)", { tag: "@api" }, async ({ page }) => {
    const oldRefreshToken = await test.step('Given I have sent POST "/auth/logout" with my session cookies', async () => {
      const token = await cookieValue(page, "refresh_token");
      expect(token).toBeTruthy();
      expect((await logOutViaApi(page)).status()).toBe(204);
      return token as string;
    });
    const response = await test.step('When I send POST "/auth/refresh" with the old "refresh_token" cookie', () => {
      return page.request.post(`${authUrl}/auth/refresh`, { headers: { cookie: `refresh_token=${oldRefreshToken}` } });
    });
    await expectStatus(response, 401);
    await expectErrorMessage(response, "Invalid or expired refresh token");
    await test.step("And no new cookies are set", () => {
      expect(setCookieHeaders(response)).toEqual([]);
    });
  });

  test("Session endpoint rejects the browser after logout (AC-38)", { tag: "@api" }, async ({ page }) => {
    await test.step('Given I have sent POST "/auth/logout" with my session cookies', async () => {
      expect((await logOutViaApi(page)).status()).toBe(204);
    });
    const response = await test.step('When I send GET "/auth/me" without an "access_token" cookie', async () => {
      expect(await cookieValue(page, "access_token")).toBeUndefined();
      return page.request.get(`${authUrl}/auth/me`);
    });
    await expectStatus(response, 401);
    await expectErrorMessage(response, "Not authenticated");
  });

  test("Logout without a session is accepted", { tag: "@api" }, async ({ page, context }) => {
    const response = await test.step('When I send POST "/auth/logout" without cookies', async () => {
      await context.clearCookies();
      return logOutViaApi(page);
    });
    await expectStatus(response, 204);
  });
});
