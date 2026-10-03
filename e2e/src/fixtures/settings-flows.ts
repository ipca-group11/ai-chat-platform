import { test, type Page } from "@playwright/test";

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
  await page
    .getByRole("form", { name: new RegExp(`${provider} API key form`, "i") })
    .getByRole("button", { name: /save key|update key/i })
    .click();
}

/** Key for specs that need an LLM reply: a real one, or any text when the stack runs against the LLM mock (profile `llm`). */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

/**
 * Skips the calling test unless `ANTHROPIC_API_KEY` is set; otherwise saves it in
 * Settings so this tab's chats can call Anthropic. Keys live in the tab's
 * sessionStorage, so call it on the same page that will send messages.
 */
export async function configureAnthropicKey(page: Page): Promise<void> {
  test.skip(!ANTHROPIC_API_KEY, "Needs a real LLM reply: set ANTHROPIC_API_KEY to run.");
  await openSettings(page);
  // Its own locators: the label regex of `apiKeyField` also matches the form, so it is ambiguous.
  const form = page.getByRole("form", { name: /anthropic api key form/i });
  await form.getByRole("textbox", { name: /anthropic api key/i }).fill(ANTHROPIC_API_KEY);
  await form.getByRole("button", { name: /save key|update key/i }).click();
}

export async function removeApiKey(page: Page, provider: string): Promise<void> {
  const row = apiKeyField(page, provider).locator("..");
  await row.getByRole("button", { name: /remove/i }).click();
}

export async function testConnection(page: Page, provider: string): Promise<void> {
  const row = apiKeyField(page, provider).locator("..");
  await row.getByRole("button", { name: /test connection/i }).click();
}
