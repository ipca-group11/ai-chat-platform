import type { Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { FIXED_TIME } from "./lib/data.js";
import { installFonts } from "./lib/fonts.js";
import { EMPTY_CHATS, installApiMocks, SIGNED_OUT, WITH_CHATS, type ApiScenario } from "./lib/mock-api.js";
import { startApps, stopApps } from "./lib/servers.js";

/**
 * Visual regression of the nine key screens, light and dark (AICHAT-19). The built shell and
 * remotes are served from `apps/*\/dist`, every API call is answered with fixed JSON, the clock
 * is frozen and the fonts come from local files, so a run needs no stack and the images are the
 * same on every run. Baselines are made in the Playwright Docker image only, see
 * docs/AICHAT-19/RUNNING.md.
 */

const THEMES = ["light", "dark"] as const;

interface Screen {
  name: string;
  path: string;
  scenario: ApiScenario;
  /** Waits until the screen is complete; may also act (open a dialog, submit a form). */
  ready: (page: Page) => Promise<void>;
  /** Block the auth remote, to see the shell's fallback. */
  blockAuthRemote?: boolean;
}

const SCREENS: readonly Screen[] = [
  {
    name: "login",
    path: "/login",
    scenario: SIGNED_OUT,
    ready: async (page) => {
      await expect(page.getByRole("form", { name: "Login form" })).toBeVisible();
    },
  },
  {
    name: "login-validation-error",
    path: "/login",
    scenario: SIGNED_OUT,
    ready: async (page) => {
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    name: "register",
    path: "/register",
    scenario: SIGNED_OUT,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /create/i })).toBeVisible();
    },
  },
  {
    name: "chat-list-empty",
    path: "/chats",
    scenario: EMPTY_CHATS,
    ready: async (page) => {
      await expect(page.getByRole("button", { name: /new chat/i }).first()).toBeVisible();
    },
  },
  {
    name: "chat-list",
    path: "/chats",
    scenario: WITH_CHATS,
    ready: async (page) => {
      await expect(page.getByText("Trip planning for Lisbon")).toBeVisible();
    },
  },
  {
    name: "chat-detail",
    path: "/chats/chat-1",
    scenario: WITH_CHATS,
    ready: async (page) => {
      await expect(page.getByRole("log", { name: /messages/i })).toContainText("Book a table for dinner");
    },
  },
  {
    name: "new-chat-dialog",
    path: "/chats",
    scenario: WITH_CHATS,
    ready: async (page) => {
      await page.getByRole("button", { name: /new chat/i }).first().click();
      await expect(page.getByRole("dialog", { name: "New chat" })).toBeVisible();
    },
  },
  {
    name: "settings-api-keys",
    path: "/settings",
    scenario: WITH_CHATS,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /api keys/i }).first()).toBeVisible();
    },
  },
  {
    name: "remote-failure-fallback",
    path: "/login",
    scenario: SIGNED_OUT,
    blockAuthRemote: true,
    ready: async (page) => {
      await expect(page.getByTestId("remote-fallback-auth")).toBeVisible();
    },
  },
];

let servers: Server[] = [];
test.beforeAll(async () => {
  servers = await startApps();
});
test.afterAll(async () => {
  await stopApps(servers);
});

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(`${screen.name} (${theme})`, async ({ page }) => {
      await page.clock.install({ time: new Date(FIXED_TIME) });
      await page.clock.setFixedTime(new Date(FIXED_TIME));
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await installFonts(page);
      const unexpected = await installApiMocks(page, screen.scenario);
      if (screen.blockAuthRemote) await page.route("http://localhost:5001/**", (route) => route.abort());

      await page.goto(screen.path);
      await screen.ready(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");

      expect(unexpected, "API calls nobody mocked").toEqual([]);
      await expect(page).toHaveScreenshot(`${screen.name}-${theme}.png`, { fullPage: true });
    });
  }
}
