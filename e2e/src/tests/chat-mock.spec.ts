import { expect, test, type Page } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import { messagesLog, sendMessage, stopReplyAndExpectCancelled, waitForStreamToFinish } from "../fixtures/chat-flows.js";
import { waitForLlmRequest } from "../fixtures/llm-mock.js";
import { configureAnthropicKey } from "../fixtures/settings-flows.js";
import { freshUser } from "../fixtures/test-users.js";

/**
 * Chat flows against the LLM mock (compose profile `llm`, AICHAT-144): send, stream, cancel,
 * retry and provider error. conversation-service calls the mock instead of Anthropic, and the
 * mock picks its scenario from the model name (`claude-haiku-4-5@long`), so each test makes its
 * chat through the API with the scenario it needs. Any text works as the API key.
 */

const MODEL = "claude-haiku-4-5";

/** Creates a chat for the signed-in user whose answers follow `scenario` of the LLM mock. */
async function createChatWithScenario(page: Page, scenario: string): Promise<string> {
  const res = await page.request.post("/api/chats", {
    data: { title: `Mock ${scenario}`, provider: "anthropic", model: `${MODEL}@${scenario}` },
  });
  expect(res.status()).toBe(201);
  const id = ((await res.json()) as { chat: { id: string } }).chat.id;
  await page.goto(`/chats/${id}`);
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  return id;
}

const assistantText = (page: Page) => messagesLog(page).locator(".typeset").last();

test.describe("chat flows against the LLM mock", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-mock"));
    await configureAnthropicKey(page);
  });

  test("send and stream: the answer arrives token by token and is saved", async ({ page }) => {
    await createChatWithScenario(page, "ok");
    await sendMessage(page, "Hello mock");
    await expect(messagesLog(page)).toContainText("Hello mock");

    await expect(page.getByRole("status", { name: "Generating response" })).toBeVisible();
    await waitForStreamToFinish(page);
    await expect(assistantText(page)).not.toHaveText("");
    const answer = await assistantText(page).innerText();

    await page.reload();
    await expect(assistantText(page)).toHaveText(answer);
  });

  // AICHAT-204: this test used to pass even when Stop did nothing, because it only checked that some
  // text was saved and the "long" answer also ends on its own. It now proves the cancellation.
  test("cancel: Stop keeps the part that was already written", async ({ page }) => {
    const prompt = `Write a very long story ${Date.now()}`;
    await createChatWithScenario(page, "long");
    await sendMessage(page, prompt);

    const partial = await stopReplyAndExpectCancelled(page);

    // AICHAT-201: conversation-service closed the connection to the provider; the answer was never completed.
    const upstream = await waitForLlmRequest(page.request, prompt, (r) => r.clientClosedAt !== null);
    expect(upstream.finishedAt).toBeNull();

    // AICHAT-202: after a reload the partial text is still there and still marked as stopped.
    await page.reload();
    await expect(assistantText(page)).toHaveText(partial);
    await expect(messagesLog(page).getByTestId("stopped-indicator")).toBeVisible();
  });

  test("cancel: a queued message can be removed before it is answered", async ({ page }) => {
    await createChatWithScenario(page, "long");
    await sendMessage(page, "First message");
    await expect(page.getByRole("status", { name: "Generating response" })).toBeVisible();
    await sendMessage(page, "Second message");

    const queued = page.getByRole("region", { name: "Queued messages" });
    await expect(queued).toContainText("Second message");
    await queued.getByRole("button", { name: "Cancel Second message" }).click();
    await expect(queued).toHaveCount(0);
  });

  test("provider error and retry: the failure is shown and Retry gets an answer", async ({ page }) => {
    const id = await createChatWithScenario(page, "error-529");
    await sendMessage(page, "This will fail");

    const failed = page.getByText("Response failed");
    await expect(failed).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

    // The provider recovers: the chat goes back to the normal scenario, then the message is retried.
    const patch = await page.request.patch(`/api/chats/${id}`, { data: { model: MODEL } });
    expect(patch.ok()).toBe(true);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(failed).toHaveCount(0, { timeout: 30_000 });
    await waitForStreamToFinish(page);
    await expect(assistantText(page)).not.toHaveText("");
  });
});
