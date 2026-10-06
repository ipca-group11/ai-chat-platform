import { randomUUID } from "node:crypto";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { registerAndLogIn } from "./support/auth.js";

/** A real OpenAI key, for "Test connection succeeds with a valid key". The scenario is skipped without it. */
const validOpenAiKey = process.env["E2E_OPENAI_API_KEY"];

const sessionNotice = "Keys are only kept for this browser tab session. Enter the key again to use it in chats.";

/** The card of a provider on the "Settings" page, from its name in the Gherkin ("OpenAI"). */
function providerCard(page: Page, provider: string): Locator {
  return page.getByTestId(`provider-card-${provider.toLowerCase()}`);
}

/** Registers a new account and signs in with it through the login page. */
async function logInAsNewUser(page: Page) {
  await registerAndLogIn(page, "api-keys");
}

async function openSettingsPage(page: Page) {
  await page.goto("/settings");
  await expect(page.getByTestId("settings-heading")).toBeVisible();
}

async function typeKey(page: Page, keyword: string, provider: string, key: string) {
  await test.step(`${keyword} I type "${key}" in "${provider} API key"`, async () => {
    await providerCard(page, provider).getByTestId("api-key").fill(key);
  });
}

async function clickSaveKey(page: Page, provider: string) {
  await test.step(`And I click "Save key" on the "${provider}" card`, async () => {
    const button = providerCard(page, provider).getByTestId("save-key");
    await expect(button).toHaveText("Save key");
    await button.click();
  });
}

async function givenSavedOpenAiKey(page: Page, key: string) {
  await test.step(`Given I have saved the OpenAI key "${key}"`, async () => {
    const card = providerCard(page, "OpenAI");
    await card.getByTestId("api-key").fill(key);
    await card.getByTestId("save-key").click();
    await expect(card.getByTestId("masked-key")).toHaveText(`••••${key.slice(-4)}`);
  });
}

async function expectBadge(page: Page, line: string, provider: string, badge: string) {
  await test.step(line, async () => {
    await expect(providerCard(page, provider).getByTestId("provider-badge")).toHaveText(badge);
  });
}

async function expectNoKeyConfigured(page: Page, line: string, provider: string) {
  await test.step(line, async () => {
    await expect(providerCard(page, provider).getByTestId("masked-key-empty")).toHaveText("No key configured");
  });
}

async function expectCurrentKey(page: Page, keyword: string, provider: string, masked: string) {
  await test.step(`${keyword} I see "Current key" followed by "${masked}"`, async () => {
    const card = providerCard(page, provider);
    await expect(card.getByTestId("masked-key-label")).toHaveText("Current key");
    await expect(card.getByTestId("masked-key")).toHaveText(masked);
  });
}

test.describe("Configure an API key", () => {
  test.beforeEach(async ({ page }) => {
    await test.step("Given I am logged in as a registered user", async () => {
      await logInAsNewUser(page);
    });
    await test.step("And I have no API key saved for OpenAI or Anthropic", async () => {
      await page.evaluate(() => {
        for (const storage of [localStorage, sessionStorage]) {
          for (const key of Object.keys(storage)) {
            if (key.startsWith("llm-api-key")) storage.removeItem(key);
          }
        }
      });
    });
    await test.step('And I am on the "Settings" page', async () => {
      await openSettingsPage(page);
    });
  });

  test("Settings page is reachable from the navigation (AC-75)", async ({ page }) => {
    await test.step('Given I am on the "Chats" page', async () => {
      await page.goto("/chats");
      await expect(page.getByTestId("chats-heading")).toBeVisible();
    });
    await test.step('When I click "Settings" in the main navigation', async () => {
      const link = page.getByTestId("nav-settings");
      await expect(link).toHaveText("Settings");
      await link.click();
    });
    await test.step('Then the URL path is "/settings"', async () => {
      await expect(page).toHaveURL(/\/settings$/);
    });
    await test.step('And I see the heading "LLM Provider API Keys"', async () => {
      await expect(page.getByTestId("settings-heading")).toHaveText("LLM Provider API Keys");
    });
  });

  test("Only providers that need a key are listed (AC-77)", async ({ page }) => {
    await test.step("When I look at the provider list", async () => {
      await expect(page.getByTestId("provider-list")).toBeVisible();
    });
    for (const [keyword, provider] of [["Then", "OpenAI"], ["And", "Anthropic"]] as const) {
      await test.step(`${keyword} I see a card "${provider}" with the badge "Not configured" and the text "No key configured"`, async () => {
        const card = providerCard(page, provider);
        await expect(card.getByTestId("provider-name")).toHaveText(provider);
        await expect(card.getByTestId("provider-badge")).toHaveText("Not configured");
        await expect(card.getByTestId("masked-key-empty")).toHaveText("No key configured");
      });
    }
    await test.step('And I see no card for "Ollama"', async () => {
      await expect(page.getByTestId("provider-name").filter({ hasText: "Ollama" })).toHaveCount(0);
    });
  });

  const keysToSave = [
    { provider: "OpenAI", key: "sk-test-1234567890abcd", last4: "abcd" },
    { provider: "Anthropic", key: "sk-ant-test-1234567890", last4: "7890" },
  ];

  for (const { provider, key, last4 } of keysToSave) {
    test(`Save a key for a provider (AC-76, AC-84): ${provider}`, async ({ page }) => {
      await typeKey(page, "When", provider, key);
      await clickSaveKey(page, provider);

      await expectBadge(page, `Then the "${provider}" card shows the badge "Configured"`, provider, "Configured");
      await expectCurrentKey(page, "And", provider, `••••${last4}`);
      await test.step(`And the "${provider} API key" field is empty`, async () => {
        await expect(providerCard(page, provider).getByTestId("api-key")).toHaveValue("");
      });
      await test.step(`And the full key "${key}" is not shown anywhere on the page`, async () => {
        expect(await page.content()).not.toContain(key);
      });
      await test.step(`And the "${provider}" card shows the buttons "Update key" and "Remove key"`, async () => {
        const card = providerCard(page, provider);
        await expect(card.getByTestId("update-key")).toHaveText("Update key");
        await expect(card.getByTestId("remove-key")).toHaveText("Remove key");
      });
    });
  }

  for (const value of ["", "   "]) {
    test(`Empty key is rejected: "${value}"`, async ({ page }) => {
      await typeKey(page, "When", "OpenAI", value);
      await clickSaveKey(page, "OpenAI");

      await test.step('Then I see the error "API key is required."', async () => {
        await expect(providerCard(page, "OpenAI").getByTestId("api-key-error")).toHaveText("API key is required.");
      });
      await expectBadge(page, 'And the "OpenAI" card still shows the badge "Not configured"', "OpenAI", "Not configured");
      await expectNoKeyConfigured(page, 'And the "OpenAI" card still shows "No key configured"', "OpenAI");
    });
  }

  test("Update a saved key (AC-76)", async ({ page }) => {
    await givenSavedOpenAiKey(page, "sk-test-1234567890abcd");

    await typeKey(page, "When", "OpenAI", "sk-test-updated00009999");
    await test.step('And I click "Update key" on the "OpenAI" card', async () => {
      const button = providerCard(page, "OpenAI").getByTestId("update-key");
      await expect(button).toHaveText("Update key");
      await button.click();
    });

    await expectCurrentKey(page, "Then", "OpenAI", "••••9999");
    await expectBadge(page, 'And the "OpenAI" card shows the badge "Configured"', "OpenAI", "Configured");
  });

  test("Remove a saved key (AC-76)", async ({ page }) => {
    await givenSavedOpenAiKey(page, "sk-test-1234567890abcd");

    await test.step('When I click "Remove key" on the "OpenAI" card', async () => {
      const button = providerCard(page, "OpenAI").getByTestId("remove-key");
      await expect(button).toHaveText("Remove key");
      await button.click();
    });

    await expectBadge(page, 'Then the "OpenAI" card shows the badge "Not configured"', "OpenAI", "Not configured");
    await expectNoKeyConfigured(page, 'And the "OpenAI" card shows "No key configured"', "OpenAI");
    await test.step('And the "OpenAI" card shows the button "Save key"', async () => {
      await expect(providerCard(page, "OpenAI").getByTestId("save-key")).toHaveText("Save key");
    });
    await test.step('And the "OpenAI" card has no "Remove key" button', async () => {
      await expect(providerCard(page, "OpenAI").getByTestId("remove-key")).toHaveCount(0);
    });
  });

  test("Test connection is disabled without a typed key", async ({ page }) => {
    await test.step('When the "OpenAI API key" field is empty', async () => {
      await expect(providerCard(page, "OpenAI").getByTestId("api-key")).toHaveValue("");
    });
    await test.step('Then the button "Test OpenAI connection" is disabled', async () => {
      const button = providerCard(page, "OpenAI").getByTestId("test-connection");
      await expect(button).toHaveText("Test OpenAI connection");
      await expect(button).toBeDisabled();
    });
  });

  test("Test connection succeeds with a valid key (AC-85)", async ({ page }) => {
    test.skip(!validOpenAiKey, "Needs a real OpenAI key in E2E_OPENAI_API_KEY");
    const card = providerCard(page, "OpenAI");

    await test.step('When I type a valid OpenAI key in "OpenAI API key"', async () => {
      await card.getByTestId("api-key").fill(validOpenAiKey ?? "");
    });
    await test.step('And I click "Test OpenAI connection"', async () => {
      await card.getByTestId("test-connection").click();
    });
    await test.step('Then I see the message "Connection successful."', async () => {
      await expect(card.getByTestId("test-connection-success")).toHaveText("Connection successful.");
    });
  });

  test("Test connection fails with an invalid key (AC-85)", async ({ page }) => {
    const card = providerCard(page, "OpenAI");
    const button = card.getByTestId("test-connection");

    await typeKey(page, "When", "OpenAI", "sk-invalid-key");
    await test.step('And I click "Test OpenAI connection"', async () => {
      await expect(button).toHaveText("Test OpenAI connection");
      await button.click();
    });

    await test.step("Then I see an error alert below the button", async () => {
      const alert = card.getByTestId("test-connection-error");
      await expect(alert).toBeVisible();
      const buttonBox = await button.boundingBox();
      const alertBox = await alert.boundingBox();
      expect(alertBox?.y).toBeGreaterThanOrEqual((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0));
    });
    await test.step('And I do not see "Connection successful."', async () => {
      await expect(card.getByTestId("test-connection-success")).toHaveCount(0);
    });
    await expectNoKeyConfigured(page, 'And the "OpenAI" card still shows "No key configured"', "OpenAI");
  });

  test("Saved key must be entered again in a new tab session (AC-78)", async ({ page, context }) => {
    await givenSavedOpenAiKey(page, "sk-test-1234567890abcd");

    const newTab = await test.step('When I open the "Settings" page in a new browser tab', async () => {
      const tab = await context.newPage();
      await openSettingsPage(tab);
      return tab;
    });

    await expectBadge(newTab, 'Then the "OpenAI" card shows the badge "Re-enter key"', "OpenAI", "Re-enter key");
    await expectCurrentKey(newTab, "And", "OpenAI", "••••abcd");
    await test.step(`And I see "${sessionNotice}"`, async () => {
      await expect(providerCard(newTab, "OpenAI").getByTestId("reenter-key-notice")).toHaveText(sessionNotice);
    });
  });

  test("Another user does not see my key (AC-80)", async ({ page }) => {
    await givenSavedOpenAiKey(page, "sk-test-1234567890abcd");

    await test.step("When I log out", async () => {
      await page.getByTestId("log-out").click();
      await expect(page).toHaveURL(/\/login/);
    });
    await test.step("And I log in as a different registered user", async () => {
      await logInAsNewUser(page);
    });
    await test.step('And I open the "Settings" page', async () => {
      await openSettingsPage(page);
    });

    await expectBadge(page, 'Then the "OpenAI" card shows the badge "Not configured"', "OpenAI", "Not configured");
    await expectNoKeyConfigured(page, 'And the "OpenAI" card shows "No key configured"', "OpenAI");
  });

  test("Chat asks for a key after the key is removed (AC-87)", async ({ page }) => {
    await givenSavedOpenAiKey(page, "sk-test-1234567890abcd");
    await test.step('And I have clicked "Remove key" on the "OpenAI" card', async () => {
      await providerCard(page, "OpenAI").getByTestId("remove-key").click();
    });

    await test.step("When I send a message in a chat that uses an OpenAI model", async () => {
      // The chat is created through the API with the page's session; only the message goes through the UI.
      const created = await page.request.post("/api/chats", {
        data: { title: `API key ${randomUUID()}`, provider: "openai", model: "gpt-4o-mini" },
      });
      expect(created.status()).toBe(201);
      const { chat } = (await created.json()) as { chat: { id: string } };
      await page.goto(`/chats/${chat.id}`);
      await page.getByTestId("message-input").fill("Hello");
      await page.getByTestId("send-message").click();
    });

    await test.step('Then I see the alert "Response failed" with the text "Missing OpenAI API key"', async () => {
      await expect(page.getByTestId("message-error-title")).toHaveText("Response failed");
      await expect(page.getByTestId("message-error-text")).toHaveText("Missing OpenAI API key");
    });
    await test.step("And no assistant reply is shown for that message", async () => {
      await expect(page.getByTestId("assistant-reply")).toHaveCount(0);
    });
  });
});
