import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { TestUser } from "./test-users.js";

/**
 * Shared login/register flows reused across specs, built on the
 * accessible-name selector contract documented in `e2e/README.md`. Centralizing
 * these here means only one place needs updating if the real `mfe-auth`
 * markup ends up differing from this assumption.
 */

export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: /create account|register/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page).toHaveURL(/\/chats/);
}

export async function registerAndLogin(page: Page, user: TestUser): Promise<void> {
  await registerUser(page, user);
  await loginUser(page, user);
}
