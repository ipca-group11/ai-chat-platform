import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { startDropProxy, type DropProxy } from "./support/drop-proxy.js";
import { waitForLlmRequest } from "../support/llm-mock.js";
import { registerAndLogIn } from "./support/auth.js";

/**
 * AICHAT-170, a network drop in the middle of a streamed reply never leaves the chat hanging.
 * Agreed rule (AICHAT-167): while the stream is down the chat shows "Reconnecting…"; the open that
 * follows the drop refetches the messages, so the reply ends as it was saved, even when its `done`
 * event was published while the browser was offline. The reply comes from the LLM mock's `long`
 * scenario (a few seconds of tokens), against the `llm` compose profile.
 *
 * A drop is two things: `context.setOffline(true)` makes the browser's reconnects fail, and the
 * proxy cuts the open stream (offline emulation alone keeps an open response flowing). The whole
 * test runs through the proxy, so cookies and the key in sessionStorage belong to its origin.
 */

/** The mock accepts any key; against a real provider set E2E_ANTHROPIC_API_KEY. */
const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const longReplyModel = "claude-haiku-4-5@long";
const appUrl = new URL(process.env["BASE_URL"] ?? "http://localhost:8000");
/** One proxy port per parallel worker (8100, 8101, …; Playwright sets TEST_PARALLEL_INDEX), so workers never share one. */
const proxyPort = Number(process.env["E2E_DROP_PROXY_PORT"] ?? "8100") + Number(process.env["TEST_PARALLEL_INDEX"] ?? "0");

let proxy: DropProxy | undefined;
test.beforeAll(async () => {
  proxy = await startDropProxy(appUrl, proxyPort);
});
test.afterAll(async () => {
  await proxy?.close();
});
test.use({ baseURL: `http://localhost:${proxyPort}` });

/** The network goes down: open connections die and new ones fail. */
async function dropNetwork(context: BrowserContext) {
  await context.setOffline(true);
  proxy?.cutConnections();
}

async function saveAnthropicKey(page: Page) {
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toHaveText(`••••${anthropicKey.slice(-4)}`);
}

async function openNewChat(page: Page, title: string) {
  const res = await page.request.post("/api/chats", { data: { title, provider: "anthropic", model: longReplyModel } });
  expect(res.status()).toBe(201);
  const chatId = ((await res.json()) as { chat: { id: string } }).chat.id;
  await page.goto(`/chats/${chatId}`);
  await expect(page.getByTestId("message-input")).toBeVisible();
}

const lastReply = (page: Page) => page.getByTestId("messages").getByTestId("assistant-message").last().getByTestId("assistant-reply");
const reconnecting = (page: Page) => page.getByRole("status", { name: "Reconnecting" });

/** Sends `prompt` and waits until the reply is visibly streaming. */
async function startReply(page: Page, prompt: string) {
  await page.getByTestId("message-input").fill(prompt);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("generating")).toBeVisible();
  await expect(lastReply(page)).not.toBeEmpty();
}

/** After a reload the history comes from the database only: what was saved. */
async function savedReplyText(page: Page): Promise<string> {
  await page.reload();
  await expect(page.getByTestId("generating")).toHaveCount(0);
  return lastReply(page).innerText();
}

test.describe("SSE reconnection (AICHAT-170)", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogIn(page, "reconnect");
    await saveAnthropicKey(page);
  });

  test("a drop in the middle of a reply shows Reconnecting…, and the reply ends as it was saved", async ({ page, context }) => {
    await openNewChat(page, "Drop mid-stream");
    await startReply(page, `Write a long story ${Date.now()}`);

    await dropNetwork(context);
    await expect(reconnecting(page)).toBeVisible();
    await page.waitForTimeout(1_000);
    await context.setOffline(false);

    await expect(reconnecting(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 30_000 });
    const shown = await lastReply(page).innerText();
    expect(shown.length).toBeGreaterThan(0);
    expect(await savedReplyText(page)).toBe(shown);
  });

  test("a drop that spans the end of the reply does not leave it streaming", async ({ page, context, request }) => {
    const prompt = `Write a long story ${Date.now()}`;
    await openNewChat(page, "Drop over done");
    await startReply(page, prompt);

    await dropNetwork(context);
    // Offline until the provider has sent the whole answer: the `done` event is published meanwhile.
    await waitForLlmRequest(request, prompt, (entry) => entry.finishedAt !== null, 30_000);
    await expect(page.getByTestId("generating"), "nothing can end the reply while offline").toBeVisible();
    await context.setOffline(false);

    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 15_000 });
    const shown = await lastReply(page).innerText();
    expect(await savedReplyText(page)).toBe(shown);
  });

  // The tests above end the drop with the browser's `online` event, which also makes React Query
  // refetch the messages on its own (refetchOnReconnect). Here the outage is on the server side and the
  // browser stays online: only the stream's reconnect and refetch (AICHAT-168) can end the reply.
  test("a server-side outage that spans the end of the reply (browser stays online) does not leave it streaming", async ({ page, request }) => {
    const prompt = `Write a long story ${Date.now()}`;
    await openNewChat(page, "Server outage over done");
    await startReply(page, prompt);

    proxy?.setDown(true);
    await expect(reconnecting(page)).toBeVisible();
    await waitForLlmRequest(request, prompt, (entry) => entry.finishedAt !== null, 30_000);
    await expect(page.getByTestId("generating"), "nothing can end the reply during the outage").toBeVisible();
    proxy?.setDown(false);

    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 15_000 });
    await expect(reconnecting(page)).toHaveCount(0);
    const shown = await lastReply(page).innerText();
    expect(await savedReplyText(page)).toBe(shown);
  });

  test("a long drop keeps Reconnecting… visible until the connection is back", async ({ page, context }) => {
    await openNewChat(page, "Long drop");
    await startReply(page, `Write a long story ${Date.now()}`);

    await dropNetwork(context);
    await expect(reconnecting(page)).toBeVisible();
    await expect(reconnecting(page)).toHaveText("Reconnecting…");
    // Longer than the browser's retry delay and the client's 3 s reopen delay: still shown, still not hanging silently.
    await page.waitForTimeout(6_000);
    await expect(reconnecting(page)).toBeVisible();

    await context.setOffline(false);
    await expect(reconnecting(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 30_000 });
  });
});
