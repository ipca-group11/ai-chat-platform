import { expect, test } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import { createChat, selectProvider, sendMessage } from "../fixtures/chat-flows.js";
import {
  apiKeyField,
  openSettings,
  removeApiKey,
  saveApiKey,
  testConnection,
} from "../fixtures/settings-flows.js";
import { freshUser } from "../fixtures/test-users.js";

/** configuration stories (docs/BACKLOG.json, pod `configuration`). */

test.describe("configuration", () => {
  test("US-23: API key management UI (FR17, UC8)", async ({ page }) => {
    await registerAndLogin(page, freshUser("config-ui"));

    await test.step("AC-75: the configuration page is reachable from the app navigation", async () => {
      await page.getByRole("link", { name: /settings|configuration/i }).click();
      await expect(page).toHaveURL(/\/settings/);
    });

    await test.step("AC-76: the user can enter, update, and remove a key for OpenAI and Anthropic", async () => {
      await saveApiKey(page, "OpenAI", "sk-test-1234567890abcd");
      await expect(apiKeyField(page, "OpenAI")).not.toHaveValue("");
      await saveApiKey(page, "OpenAI", "sk-test-updated0000abcd");

      await saveApiKey(page, "Anthropic", "sk-ant-test-1234567890");
      await expect(apiKeyField(page, "Anthropic")).not.toHaveValue("");

      await removeApiKey(page, "OpenAI");
      await expect(apiKeyField(page, "OpenAI")).toHaveValue("");
    });

    await test.step("AC-77: only key-based providers are listed (no local/keyless provider)", async () => {
      await expect(page.getByText(/ollama/i)).toHaveCount(0);
      await expect(page.getByText(/no key|not required|no api key needed/i)).toHaveCount(0);
    });
  });

  test("US-24: Client-side-only key storage (FR18)", async ({ page, browser }) => {
    await registerAndLogin(page, freshUser("config-storage"));
    await openSettings(page);

    await test.step("AC-78: the key is stored only in the browser (localStorage), scoped to the user", async () => {
      await saveApiKey(page, "OpenAI", "sk-test-localstorage-only");
      const storage = await page.evaluate(() => JSON.stringify(localStorage));
      expect(storage).toMatch(/sk-test-localstorage-only/);
    });

    await test.step("AC-79: the key is never sent to the server for storage (no server round-trip other than the request the user made to use it)", async () => {
      const requests: string[] = [];
      page.on("request", (req) => requests.push(req.url() + " " + (req.postData() ?? "")));
      await page.reload();
      const leaked = requests.some((r) => r.includes("sk-test-localstorage-only"));
      expect(leaked).toBe(false);
    });

    await test.step("AC-80: logging in as a different user does not expose the first user's stored key", async () => {
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await registerAndLogin(page2, freshUser("config-storage-2"));
      await openSettings(page2);
      await expect(apiKeyField(page2, "OpenAI")).toHaveValue("");
      await context2.close();
    });
  });

  test("US-25: Key usage on LLM-calling requests (FR19)", async ({ page }) => {
    await registerAndLogin(page, freshUser("config-key-usage"));
    await openSettings(page);
    await saveApiKey(page, "OpenAI", "sk-test-header-check-0000");

    await createChat(page);
    await selectProvider(page, "OpenAI");

    await test.step("AC-81: the browser sends the provider's key with each LLM-calling request", async () => {
      const [request] = await Promise.all([
        page.waitForRequest((req) => /\/api\/chats\/.*\/(messages|stream)/i.test(req.url())),
        sendMessage(page, "Hello with my own key"),
      ]);
      const headers = request.headers();
      const hasKeyHeader = Object.entries(headers).some(
        ([name, value]) => /api-?key/i.test(name) || value.includes("sk-test-header-check-0000"),
      );
      expect(hasKeyHeader).toBe(true);
    });

    test.fixme(
      true,
      "AC-82 (conversation-service uses the key only for that request and never " +
        "persists it) and AC-83 (the key is redacted from logs/error responses) " +
        "are server-side, non-persistence properties with no client-observable " +
        "signal beyond the header check above; verified by conversation-service's " +
        "own unit/integration tests and log-redaction tests.",
    );
  });

  test("US-26: Masked display, test connection, and missing-key messaging (FR20, UC8)", async ({
    page,
  }) => {
    await registerAndLogin(page, freshUser("config-masking"));
    await openSettings(page);

    await test.step("AC-84: saved keys are displayed masked, never in full", async () => {
      await saveApiKey(page, "OpenAI", "sk-test-1234567890abcd");
      await expect(apiKeyField(page, "OpenAI")).not.toHaveValue("sk-test-1234567890abcd");
      await expect(page.getByText(/sk-\.{3}|sk-…|sk-\*+/)).toBeVisible();
    });

    await test.step("AC-85: 'Test connection' validates the key and shows success or a clear failure reason", async () => {
      await testConnection(page, "OpenAI");
      await expect(page.getByText(/success|connected|valid/i)).toBeVisible();

      await saveApiKey(page, "OpenAI", "sk-invalid-key");
      await testConnection(page, "OpenAI");
      await expect(page.getByRole("alert")).toContainText(/invalid|failed|error/i);
    });

    await test.step("AC-87: removing the key makes that provider's chats prompt for a key again", async () => {
      await removeApiKey(page, "OpenAI");
      await createChat(page);
      await selectProvider(page, "OpenAI");
      await sendMessage(page, "Hello again");

      const prompt = page.getByText(/api key/i);
      await expect(prompt).toBeVisible();
    });

    await test.step("AC-86: the missing-key message links to the configuration page", async () => {
      await page.getByText(/api key/i).getByRole("link", { name: /configuration|settings/i }).click();
      await expect(page).toHaveURL(/\/settings/);
    });
  });
});
