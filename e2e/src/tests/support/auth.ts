import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

export const authUrl = process.env["E2E_AUTH_URL"] ?? "http://localhost:4001";
/** Meets the password rules of the registration form. */
export const accountPassword = "Passw0rd1";

export interface Account {
  email: string;
  password: string;
}

/** An account that no other run or test uses, so no row has to be deleted first. */
export function uniqueAccount(prefix = "e2e"): Account {
  return { email: `${prefix}-${randomUUID()}@example.com`, password: accountPassword };
}

/**
 * Registers the account through auth-service, with the page's request context (same cookie
 * jar as the browser); 201, or 409 when the email already exists.
 */
export function registerAccount(page: Page, account: Account) {
  return page.request.post(`${authUrl}/auth/register`, { data: account });
}

/** Signs the page in through the login page and waits for the chats page. */
export async function logIn(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByTestId("email").fill(account.email);
  await page.getByTestId("password").fill(account.password);
  await page.getByTestId("sign-in").click();
  await expect(page).toHaveURL(/\/chats$/);
}

/** Registers a new account and signs the page in with it; `page.request` then calls the APIs as that user. */
export async function registerAndLogIn(page: Page, prefix?: string): Promise<Account> {
  const account = uniqueAccount(prefix);
  const registered = await registerAccount(page, account);
  expect(registered.status()).toBe(201);
  await logIn(page, account);
  return account;
}

/**
 * `test` with an `account` fixture: a fresh registered account the page is signed in with.
 * Import `test` from here instead of `@playwright/test` to use it:
 *
 *   test("…", async ({ page, account }) => { … });
 */
export const test = base.extend<{ account: Account }>({
  account: async ({ page }, use) => {
    await use(await registerAndLogIn(page));
  },
});

export { expect };
