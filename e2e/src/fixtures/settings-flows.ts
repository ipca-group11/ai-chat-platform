import type { Page } from "@playwright/test";

/**
 * Shared `mfe-settings` (configuration page) helpers, built on the
 * accessible-name selector contract documented in `e2e/README.md`.
 */

export async function openSettings(page: Page): Promise<void> {
  await page.goto("/settings");
}

export function apiKeyField(page: Page, provider: string) {
  return page.getByLabel(new RegExp(`${provider}.*api key`, "i"));
}

export async function saveApiKey(page: Page, provider: string, key: string): Promise<void> {
  await apiKeyField(page, provider).fill(key);
  await page.getByRole("button", { name: /^save$/i }).click();
}

export async function removeApiKey(page: Page, provider: string): Promise<void> {
  const row = apiKeyField(page, provider).locator("..");
  await row.getByRole("button", { name: /remove/i }).click();
}

export async function testConnection(page: Page, provider: string): Promise<void> {
  const row = apiKeyField(page, provider).locator("..");
  await row.getByRole("button", { name: /test connection/i }).click();
}
