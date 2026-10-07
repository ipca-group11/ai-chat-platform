import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared chat-view helpers reused by the UC3-UC7 specs, built on the
 * accessible-name selector contract documented in `e2e/README.md`.
 */

/** Creates a new chat from the chat list and returns its id from the URL. */
export async function createChat(page: Page): Promise<string> {
  await page.goto("/chats");
  await page.getByRole("button", { name: /new chat/i }).click();
  // "New chat" opens a dialog (title, provider, model); Create stays disabled until a title is set.
  const dialog = page.getByRole("dialog", { name: /new chat/i });
  await dialog.getByRole("textbox", { name: /chat title/i }).fill("E2E chat");
  await dialog.getByRole("button", { name: /^create$/i }).click();
  await page.waitForURL(/\/chats\/[^/]+$/);
  const match = /\/chats\/([^/?#]+)/.exec(page.url());
  const chatId = match?.[1];
  if (!chatId) {
    throw new Error(`Could not extract chat id from URL: ${page.url()}`);
  }
  return chatId;
}

export function messageComposer(page: Page) {
  return page.getByRole("textbox", { name: /message/i });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await messageComposer(page).fill(text);
  await page.getByRole("button", { name: /^send$/i }).click();
}

export function messagesLog(page: Page) {
  return page.getByRole("log", { name: /messages/i });
}

/** Waits until no "generating a reply" status indicator is shown anymore. */
export async function waitForStreamToFinish(page: Page): Promise<void> {
  await expect(page.getByRole("status", { name: /generating|streaming/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

export function chatListItems(page: Page) {
  return page.getByRole("list", { name: /chats/i }).getByRole("listitem");
}

/** Renames the currently open chat via its "Rename" action. */
export async function renameChat(page: Page, newTitle: string): Promise<void> {
  await page.getByRole("button", { name: /rename/i }).click();
  await page.getByRole("textbox", { name: /chat name|title/i }).fill(newTitle);
  await page.getByRole("button", { name: /^save$/i }).click();
}

/** Deletes the currently open chat via its "Delete" action, confirming the dialog. */
export async function deleteChat(page: Page): Promise<void> {
  await page.getByRole("button", { name: /delete/i }).click();
  await page.getByRole("button", { name: /confirm|delete/i }).last().click();
}

/** Picks a provider/model for the currently open chat's composer. */
export async function selectProvider(page: Page, providerLabel: string): Promise<void> {
  await page.getByRole("combobox", { name: /provider|model/i }).selectOption({ label: providerLabel });
}

/** Attaches an in-memory file to the message composer. */
export async function attachFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.getByLabel(/attach a file/i).setInputFiles(file);
}

/**
 * Presses Stop on the reply that is streaming and proves it was cancelled (AICHAT-204), instead of
 * only checking that some text exists (which also passes when the reply finishes on its own):
 * - the stop request reaches the server and answers `{ stopped: true }`;
 * - the reply stops growing and is labelled "Stopped";
 * Returns the partial text.
 */
export async function stopReplyAndExpectCancelled(page: Page): Promise<string> {
  const reply = messagesLog(page).getByTestId("assistant-message").last();
  await expect(page.getByRole("status", { name: /generating|streaming/i })).toBeVisible();
  await expect(reply.locator(".typeset")).not.toHaveText("");

  const stopResponse = page.waitForResponse((r) => r.request().method() === "POST" && /\/chats\/[^/]+\/stop$/.test(new URL(r.url()).pathname));
  await reply.getByRole("button", { name: "Stop" }).click();
  const res = await stopResponse;
  expect(res.status(), "the stop request must reach a real route").toBe(200);
  expect(await res.json()).toEqual({ stopped: true });

  await waitForStreamToFinish(page);
  await expect(reply.getByTestId("stopped-indicator")).toBeVisible();
  const partial = await reply.locator(".typeset").innerText();
  // A stopped reply no longer grows.
  await page.waitForTimeout(1_000);
  await expect(reply.locator(".typeset")).toHaveText(partial);
  return partial;
}
