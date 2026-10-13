import { request as apiRequest, type Page } from "@playwright/test";
import { authUrl, expect, registerAccount, registerAndLogIn, test, uniqueAccount } from "./support/auth.js";
import { assertNoCriticalA11yViolations } from "./support/axe.js";
import { failRemote } from "./support/remote-faults.js";

/**
 * AICHAT-173: every page and UI state of the AICHAT-172 matrix, scanned with axe-core in the light and the dark theme.
 *
 * Each row reaches its state the way a user would (or through the API when only the data matters), then the scan
 * runs. The theme is stored before the first page loads and checked on <html> before the scan, so a "dark" result
 * always comes from the dark page.
 */

type Theme = "light" | "dark";
const themes: Theme[] = ["light", "dark"];

/** The mock accepts any key (compose.mock.yaml); against a real provider set E2E_ANTHROPIC_API_KEY. */
const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const model = "claude-haiku-4-5";

interface State {
  page: string;
  state: string;
  /** Signs in with a fresh account before `reach`. */
  signedIn: boolean;
  reach: (page: Page) => Promise<void>;
}

/** The shell reads `localStorage["theme"]` on start-up (apps/shell/src/shared/theme/theme.ts). */
async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
}

async function expectTheme(page: Page, theme: Theme) {
  const html = page.locator("html");
  if (theme === "dark") await expect(html).toHaveClass(/\bdark\b/);
  else await expect(html).not.toHaveClass(/\bdark\b/);
}

async function createChat(page: Page, title: string, chatModel = model): Promise<string> {
  const response = await page.request.post("/api/chats", { data: { title, provider: "anthropic", model: chatModel } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { chat: { id: string } }).chat.id;
}

/** The key lives in sessionStorage, so it is saved in the same tab that sends the messages. */
async function saveAnthropicKey(page: Page) {
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toBeVisible();
}

async function openChat(page: Page, chatId: string) {
  await page.goto(`/chats/${chatId}`);
  await expect(page.getByTestId("chat-heading")).toBeVisible();
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("generating")).toBeVisible();
}

async function waitForReplyToEnd(page: Page) {
  await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 20_000 });
}

/** Rows of the AICHAT-172 matrix (docs/AICHAT-10/WORKLOG.md, US1). */
const states: State[] = [
  {
    page: "login",
    state: "empty form",
    signedIn: false,
    reach: async (page) => {
      await page.goto("/login");
      await expect(page.getByTestId("sign-in")).toBeVisible();
    },
  },
  {
    page: "login",
    state: "wrong password",
    signedIn: false,
    reach: async (page) => {
      const account = uniqueAccount("a11y");
      const context = await apiRequest.newContext();
      expect((await context.post(`${authUrl}/auth/register`, { data: account })).status()).toBe(201);
      await context.dispose();
      await page.goto("/login");
      await page.getByTestId("email").fill(account.email);
      await page.getByTestId("password").fill("Wrong-passw0rd");
      await page.getByTestId("sign-in").click();
      await expect(page.getByTestId("login-error")).toBeVisible();
    },
  },
  {
    page: "register",
    state: "empty form",
    signedIn: false,
    reach: async (page) => {
      await page.goto("/register");
      await expect(page.getByTestId("create-account")).toBeVisible();
    },
  },
  {
    page: "register",
    state: "field errors",
    signedIn: false,
    reach: async (page) => {
      await page.goto("/register");
      await page.getByTestId("email").fill("not-an-email");
      await page.getByTestId("password").fill("short");
      await page.getByTestId("create-account").click();
      await expect(page.getByTestId("email-error")).toBeVisible();
      await expect(page.getByTestId("password-error")).toBeVisible();
    },
  },
  {
    page: "register",
    state: "email already used",
    signedIn: false,
    reach: async (page) => {
      const account = uniqueAccount("a11y");
      expect((await registerAccount(page, account)).status()).toBe(201);
      await page.context().clearCookies();
      await page.goto("/register");
      await page.getByTestId("email").fill(account.email);
      await page.getByTestId("password").fill(account.password);
      await page.getByTestId("create-account").click();
      await expect(page.getByTestId("register-error")).toBeVisible();
    },
  },
  {
    page: "chats",
    state: "no chats",
    signedIn: true,
    reach: async (page) => {
      await page.goto("/chats");
      await expect(page.getByTestId("chat-list-empty")).toBeVisible();
    },
  },
  {
    page: "chats",
    state: "with chats",
    signedIn: true,
    reach: async (page) => {
      await createChat(page, "Trip planning");
      await createChat(page, "Recipes");
      await page.goto("/chats");
      await expect(page.getByTestId("chat-item-title")).toHaveCount(2);
    },
  },
  {
    page: "chats",
    state: "new chat dialog",
    signedIn: true,
    reach: async (page) => {
      await page.goto("/chats");
      await page.getByTestId("new-chat").click();
      await expect(page.getByTestId("new-chat-dialog")).toBeVisible();
    },
  },
  {
    page: "chat",
    state: "history",
    signedIn: true,
    reach: async (page) => {
      const chatId = await createChat(page, "History");
      await saveAnthropicKey(page);
      await openChat(page, chatId);
      await send(page, "Hello there");
      await waitForReplyToEnd(page);
      await expect(page.getByTestId("assistant-reply")).not.toBeEmpty();
    },
  },
  {
    page: "chat",
    state: "stopped reply",
    signedIn: true,
    reach: async (page) => {
      const chatId = await createChat(page, "Stopped", `${model}@long`);
      await saveAnthropicKey(page);
      await openChat(page, chatId);
      await send(page, "Tell me a long story");
      await expect(page.getByTestId("assistant-reply")).not.toBeEmpty();
      await page.getByTestId("stop-response").click();
      await expect(page.getByTestId("stopped-indicator")).toBeVisible();
      await waitForReplyToEnd(page);
    },
  },
  {
    page: "chat",
    state: "failed reply",
    signedIn: true,
    reach: async (page) => {
      const chatId = await createChat(page, "Failing", `${model}@error-500`);
      await saveAnthropicKey(page);
      await openChat(page, chatId);
      await page.getByTestId("message-input").fill("This reply fails");
      await page.getByTestId("send-message").click();
      await expect(page.getByTestId("message-error-title")).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    page: "chat",
    state: "attachments",
    signedIn: true,
    reach: async (page) => {
      const chatId = await createChat(page, "Files");
      await openChat(page, chatId);
      const pick = async (name: string, mimeType: string) => {
        const chooser = page.waitForEvent("filechooser");
        await page.getByTestId("attach").click();
        await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(`Contents of ${name}`) });
      };
      // A file the browser rejects (type) and one the server rejects: the list rows and their error alerts.
      // A sent message with a file cannot be reached yet: the upload route returns 404 (follow-up in the work log, US2).
      await pick("setup.exe", "application/octet-stream");
      await pick("notes.txt", "text/plain");
      await expect(page.getByTestId("attachment")).toHaveCount(2);
      await expect(page.getByTestId("attachment-error")).toHaveCount(2, { timeout: 15_000 });
    },
  },
  {
    page: "chat",
    state: "members dialog",
    signedIn: true,
    reach: async (page) => {
      const member = uniqueAccount("a11y-member");
      const context = await apiRequest.newContext();
      expect((await context.post(`${authUrl}/auth/register`, { data: member })).status()).toBe(201);
      await context.dispose();
      const chatId = await createChat(page, "Shared");
      await openChat(page, chatId);
      await page.getByRole("button", { name: "Share chat" }).click();
      const dialog = page.getByRole("dialog", { name: "Members" });
      await dialog.getByLabel("Invite by email").fill(member.email);
      await dialog.getByRole("button", { name: "Invite" }).click();
      await expect(dialog.getByRole("list", { name: "Members" }).getByRole("listitem")).toHaveCount(2);
    },
  },
  {
    page: "chat",
    state: "not found",
    signedIn: true,
    reach: async (page) => {
      await page.goto("/chats/00000000-0000-4000-8000-000000000000");
      await expect(page.getByTestId("chat-error-heading")).toBeVisible();
    },
  },
  {
    page: "settings",
    state: "no keys",
    signedIn: true,
    reach: async (page) => {
      await page.goto("/settings");
      await expect(page.getByTestId("provider-list")).toBeVisible();
      await expect(page.getByTestId("masked-key-empty").first()).toBeVisible();
    },
  },
  {
    page: "settings",
    state: "saved key and errors",
    signedIn: true,
    reach: async (page) => {
      await saveAnthropicKey(page);
      const openai = page.getByTestId("provider-card-openai");
      await openai.getByTestId("save-key").click();
      await expect(openai.getByTestId("api-key-error")).toBeVisible();
      await openai.getByTestId("api-key").fill("sk-invalid-key");
      await openai.getByTestId("test-connection").click();
      await expect(openai.getByTestId("test-connection-error")).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    page: "chats",
    state: "remote fallback",
    signedIn: true,
    reach: async (page) => {
      await failRemote(page, "mfeChat", "abort");
      await page.goto("/chats");
      await expect(page.getByTestId("remote-fallback-chat")).toBeVisible();
    },
  },
];

test.describe("AICHAT-173: axe-core scan of every page, light and dark", () => {
  for (const { page: pageName, state, signedIn, reach } of states) {
    for (const theme of themes) {
      const label = `${pageName} · ${state} · ${theme}`;

      test(label, async ({ page }, testInfo) => {
        await useTheme(page, theme);
        if (signedIn) await registerAndLogIn(page, "a11y");
        await reach(page);
        await expectTheme(page, theme);
        await assertNoCriticalA11yViolations(page, testInfo, label);
      });
    }
  }
});
