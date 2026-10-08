import { expect, test, type Page } from "@playwright/test";
import { loginUser, registerAndLogin } from "../fixtures/auth-flows.js";
import { messagesLog, sendMessage } from "../fixtures/chat-flows.js";
import { llmRequestFor, waitForLlmRequest } from "../fixtures/llm-mock.js";
import { configureAnthropicKey } from "../fixtures/settings-flows.js";
import { freshUser, type TestUser } from "../fixtures/test-users.js";

/**
 * AICHAT-203: what leaving a chat does to a reply that is still being written (owner decision):
 * - switching to another chat or closing the tab keeps the reply running and saved (AC-60/61);
 * - logging out stops the replies the user started, because they spend that user's API key.
 * The outcome is read where it matters, at the provider: the LLM mock logs whether conversation-service
 * closed the connection before the answer was complete. Runs against the `llm` compose profile.
 */

const MODEL = "claude-haiku-4-5";
/** How long a leave that must NOT stop the reply is watched before checking the provider. */
const WATCH_MS = 1_500;

async function chatWithLongAnswer(page: Page): Promise<string> {
  const res = await page.request.post("/api/chats", {
    data: { title: "Long answer", provider: "anthropic", model: `${MODEL}@long` },
  });
  expect(res.status()).toBe(201);
  const id = ((await res.json()) as { chat: { id: string } }).chat.id;
  await page.goto(`/chats/${id}`);
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  return id;
}

/** Sends `prompt` and waits until the reply is visibly streaming. */
async function startReply(page: Page, prompt: string): Promise<void> {
  await sendMessage(page, prompt);
  await expect(page.getByRole("status", { name: "Generating response" })).toBeVisible();
  await expect(messagesLog(page).getByTestId("assistant-message").last().locator(".typeset")).not.toHaveText("");
}

test.describe("leaving a chat while the reply is written (AICHAT-203)", () => {
  let user: TestUser;

  test.beforeEach(async ({ page }) => {
    user = freshUser("leave");
    await registerAndLogin(page, user);
    await configureAnthropicKey(page);
  });

  test("switching to another chat keeps the reply running to the end", async ({ page }) => {
    const prompt = `Switch chats ${Date.now()}`;
    await chatWithLongAnswer(page);
    await startReply(page, prompt);

    const other = await page.request.post("/api/chats", { data: { title: "Other", provider: "anthropic", model: MODEL } });
    await page.goto(`/chats/${((await other.json()) as { chat: { id: string } }).chat.id}`);
    await page.waitForTimeout(WATCH_MS);

    expect((await llmRequestFor(page.request, prompt))?.clientClosedAt).toBeNull();
    const done = await waitForLlmRequest(page.request, prompt, (r) => r.finishedAt !== null, 20_000);
    expect(done.clientClosedAt).toBeNull();
  });

  test("closing the tab keeps the reply running to the end", async ({ page, context }) => {
    const prompt = `Close the tab ${Date.now()}`;
    const chatId = await chatWithLongAnswer(page);
    const tab = await context.newPage();
    // The provider key lives in sessionStorage, which is per tab: a new tab must enter it again.
    await configureAnthropicKey(tab);
    await tab.goto(`/chats/${chatId}`);
    await startReply(tab, prompt);

    await tab.close();
    await page.waitForTimeout(WATCH_MS);

    expect((await llmRequestFor(page.request, prompt))?.clientClosedAt).toBeNull();
    const done = await waitForLlmRequest(page.request, prompt, (r) => r.finishedAt !== null, 20_000);
    expect(done.clientClosedAt).toBeNull();
  });

  test("logging out stops the reply the user started", async ({ page }) => {
    const prompt = `Log out ${Date.now()}`;
    const chatId = await chatWithLongAnswer(page);
    await startReply(page, prompt);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);

    const upstream = await waitForLlmRequest(page.request, prompt, (r) => r.clientClosedAt !== null);
    expect(upstream.finishedAt, "the provider must not finish an answer after logout").toBeNull();

    // Back in: the partial reply is saved and marked as stopped (AICHAT-202).
    await loginUser(page, user);
    await page.goto(`/chats/${chatId}`);
    const reply = messagesLog(page).getByTestId("assistant-message").last();
    await expect(reply.getByTestId("stopped-indicator")).toBeVisible();
    await expect(reply.locator(".typeset")).not.toHaveText("");
  });
});
