import type { Locator, Page } from "@playwright/test";
import { expect, registerAccount, test, uniqueAccount } from "./support/auth.js";

/**
 * AICHAT-175: the main flows with the keyboard only, focus inside dialogs, a visible focus ring in both themes, and how
 * a streaming reply reaches a screen reader.
 *
 * Inside each flow the page is driven with Tab, Shift+Tab, Enter, Escape and typing only; `click()` is used only to
 * set up data that is not under test.
 */

type Theme = "light" | "dark";
const themes: Theme[] = ["light", "dark"];
const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const model = "claude-haiku-4-5";

async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
}

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement).catch(() => false);
}

/**
 * Presses Tab (or Shift+Tab) until `target` has the focus. Fails when it is not reached in `max` presses, which means
 * the element cannot be reached with the keyboard.
 */
async function tabTo(page: Page, target: Locator, { backwards = false, max = 40 } = {}) {
  for (let presses = 0; presses < max; presses++) {
    if (await isFocused(target)) return;
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
  }
  expect(await isFocused(target), `${target} is not reachable with ${backwards ? "Shift+Tab" : "Tab"}`).toBe(true);
}

/** Focus indicator drawn by the element itself: an outline or a ring (Tailwind draws `ring-*` as a box-shadow). */
async function focusIndicator(locator: Locator): Promise<string | null> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) return `outline ${style.outlineWidth} ${style.outlineColor}`;
    if (style.boxShadow !== "none") return `box-shadow ${style.boxShadow}`;
    return null;
  });
}

async function expectFocusRing(locator: Locator) {
  expect(await focusIndicator(locator), `${locator} has no visible focus indicator`).not.toBeNull();
}

async function createChat(page: Page, title: string, chatModel = model): Promise<string> {
  const response = await page.request.post("/api/chats", { data: { title, provider: "anthropic", model: chatModel } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { chat: { id: string } }).chat.id;
}

/** Set-up, not under test: the key lives in sessionStorage, so it is saved in the tab that sends. */
async function saveAnthropicKey(page: Page) {
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toBeVisible();
}

test.describe("AICHAT-175: main flows with the keyboard only", () => {
  for (const theme of themes) {
    test(`login with Tab and Enter, focus ring visible (${theme})`, async ({ page }) => {
      const account = uniqueAccount("a11y-kbd");
      expect((await registerAccount(page, account)).status()).toBe(201);
      await page.context().clearCookies();
      await useTheme(page, theme);
      await page.goto("/login");

      const email = page.getByTestId("email");
      await tabTo(page, email);
      await expectFocusRing(email);
      await page.keyboard.type(account.email);
      await page.keyboard.press("Tab");
      const password = page.getByTestId("password");
      expect(await isFocused(password), "Tab from the email goes to the password").toBe(true);
      await expectFocusRing(password);
      await page.keyboard.type(account.password);
      const signIn = page.getByTestId("sign-in");
      await tabTo(page, signIn);
      await expectFocusRing(signIn);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/chats$/);
    });

    test(`register with Tab and Enter, focus ring visible (${theme})`, async ({ page }) => {
      const account = uniqueAccount("a11y-kbd");
      await useTheme(page, theme);
      await page.goto("/register");

      const email = page.getByTestId("email");
      await tabTo(page, email);
      await page.keyboard.type(account.email);
      await page.keyboard.press("Tab");
      expect(await isFocused(page.getByTestId("password")), "Tab from the email goes to the password").toBe(true);
      await page.keyboard.type(account.password);
      const createAccount = page.getByTestId("create-account");
      await tabTo(page, createAccount);
      await expectFocusRing(createAccount);
      await page.keyboard.press("Enter");
      // After registering, the app sends the user to the sign-in page (registration.spec.ts).
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("create a chat and send a message with the keyboard", async ({ page, account }) => {
    void account;
    await saveAnthropicKey(page);
    await page.goto("/chats");

    const newChat = page.getByTestId("new-chat");
    await tabTo(page, newChat);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "New chat" });
    await expect(dialog).toBeVisible();
    const title = page.getByTestId("chat-title");
    await tabTo(page, title);
    await page.keyboard.type("Keyboard only");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("chat-heading")).toHaveText("Keyboard only");

    const input = page.getByTestId("message-input");
    await tabTo(page, input);
    await page.keyboard.type("Hello from the keyboard");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("user-message").last()).toContainText("Hello from the keyboard");
    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("assistant-reply")).not.toBeEmpty();
  });

  test("stop a reply with the keyboard", async ({ page, account }) => {
    void account;
    const chatId = await createChat(page, "Stop with keys", `${model}@long`);
    await saveAnthropicKey(page);
    await page.goto(`/chats/${chatId}`);

    const input = page.getByTestId("message-input");
    await tabTo(page, input);
    await page.keyboard.type("Tell me a long story");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("assistant-reply")).not.toBeEmpty();

    // Stop is above the composer: Shift+Tab walks back to it.
    const stop = page.getByTestId("stop-response");
    await tabTo(page, stop, { backwards: true });
    await expectFocusRing(stop);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("stopped-indicator")).toBeVisible();
  });
});

test.describe("AICHAT-175: dialogs keep the focus inside and give it back", () => {
  /**
   * Tab and Shift+Tab, 15 times. At the edges the focus first lands on an invisible focus guard of the dialog library,
   * which then moves it to the other end of the dialog a moment later, so the check waits for the focus to settle.
   */
  async function expectFocusTrapped(page: Page, dialog: Locator) {
    const settledInside = () =>
      dialog.evaluate((element) => {
        const active = document.activeElement;
        return element.contains(active) && !active?.hasAttribute("data-base-ui-focus-guard");
      });
    for (let presses = 0; presses < 15; presses++) {
      await page.keyboard.press(presses % 3 === 2 ? "Shift+Tab" : "Tab");
      await expect
        .poll(settledInside, { message: `focus left the dialog after ${presses + 1} key presses`, timeout: 2_000 })
        .toBe(true);
    }
  }

  test("new chat dialog: focus moves in, stays in, Escape returns it to New chat", async ({ page, account }) => {
    void account;
    await page.goto("/chats");
    const trigger = page.getByTestId("new-chat");
    await tabTo(page, trigger);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "New chat" });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), { message: "focus moved into the dialog" })
      .toBe(true);

    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("members dialog: focus moves in, stays in, Escape returns it to Share", async ({ page, account }) => {
    void account;
    const chatId = await createChat(page, "Shared with keys");
    await page.goto(`/chats/${chatId}`);
    const trigger = page.getByRole("button", { name: "Share chat" });
    await tabTo(page, trigger);
    await expectFocusRing(trigger);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Members" });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), { message: "focus moved into the dialog" })
      .toBe(true);

    await expectFocusTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("AICHAT-175: every element reached with Tab shows a focus indicator", () => {
  for (const theme of themes) {
    test(`chat page (${theme})`, async ({ page, account }) => {
      void account;
      await useTheme(page, theme);
      const chatId = await createChat(page, "Focus ring");
      await page.goto(`/chats/${chatId}`);
      await expect(page.getByTestId("chat-heading")).toBeVisible();

      const missing: string[] = [];
      for (let presses = 0; presses < 25; presses++) {
        await page.keyboard.press("Tab");
        const focused = page.locator(":focus");
        if ((await focused.count()) === 0) continue;
        if ((await focusIndicator(focused)) === null) {
          missing.push(await focused.evaluate((element) => element.outerHTML.slice(0, 120)));
        }
      }
      expect([...new Set(missing)], "elements without a focus indicator").toEqual([]);
    });
  }
});

test.describe("AICHAT-175: a streaming reply reaches a screen reader once", () => {
  test("Generating is a polite status and the reply is announced once, when it ends", async ({ page, account }) => {
    void account;
    const chatId = await createChat(page, "Live region", `${model}@long`);
    await saveAnthropicKey(page);
    await page.goto(`/chats/${chatId}`);

    const log = page.getByRole("log", { name: "Messages" });
    await expect(log).toHaveAttribute("aria-live", "polite");

    // A screen reader reads what changes in a polite live region unless the region is aria-busy. Record the text of
    // the reply each time it changes while the region is not busy: that is what would be announced.
    await page.evaluate(() => {
      const region = document.querySelector('[role="log"]');
      if (!region) throw new Error("no log region");
      const announced: string[] = [];
      (window as unknown as { announced: string[] }).announced = announced;
      new MutationObserver(() => {
        if (region.getAttribute("aria-busy") === "true") return;
        const replies = region.querySelectorAll('[data-testid="assistant-reply"]');
        const text = replies[replies.length - 1]?.textContent ?? "";
        if (text && text !== announced[announced.length - 1]) announced.push(text);
      }).observe(region, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-busy"] });
    });

    await page.getByTestId("message-input").fill("Tell me a long story");
    await page.getByTestId("message-input").press("Enter");
    const generating = page.getByTestId("generating");
    await expect(generating).toHaveRole("status");
    await expect.soft(log, "the region is busy while the reply is written").toHaveAttribute("aria-busy", "true");
    await expect(generating).toHaveCount(0, { timeout: 20_000 });
    await expect(log).not.toHaveAttribute("aria-busy", "true");

    const finalText = await page.getByTestId("assistant-reply").last().textContent();
    const announced = await page.evaluate(() => (window as unknown as { announced: string[] }).announced);
    expect(announced.length, `announced ${announced.length} times: ${announced.map((text) => text.length).join(", ")} characters`).toBe(1);
    expect(announced[0]).toBe(finalText);
  });
});
