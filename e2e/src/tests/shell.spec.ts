import { expect, test } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import { freshUser } from "../fixtures/test-users.js";

/** shell stories (docs/BACKLOG.json, pod `shell`). */

test.describe("shell", () => {
  test("US-7: Host app with Module Federation and routing", async ({ page }) => {
    await test.step("AC-22: mfe-auth loads as a remote at /login", async () => {
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
    });

    const user = freshUser("shell-routing");
    await registerAndLogin(page, user);

    await test.step("AC-22: mfe-chat loads as a remote at /chats", async () => {
      await expect(page).toHaveURL(/\/chats/);
      await expect(page.getByRole("button", { name: /new chat/i })).toBeVisible();
    });

    await test.step("AC-22: mfe-settings loads as a remote at /settings", async () => {
      await page.goto("/settings");
      await expect(page.locator("main, form")).toBeVisible();
    });

    await test.step("AC-23: top-level routes are real, bookmarkable, file-based routes", async () => {
      await page.goto("/chats");
      await expect(page).toHaveURL(/\/chats/);
      await page.reload();
      await expect(page.getByRole("button", { name: /new chat/i })).toBeVisible();
    });

    test.fixme(
      true,
      "AC-24 (React/React DOM/TanStack Router/TanStack Query/design-system shared " +
        "as singletons across host and remotes) is a Module Federation build " +
        "configuration detail with no distinguishing behavior observable purely " +
        "through the UI; verified by the shell's own build/bundle-analysis checks.",
    );
  });

  test("US-8: Auth guard for protected routes", async ({ page, context }) => {
    await test.step("AC-26: an unauthenticated user hitting /chats is redirected to /login", async () => {
      await context.clearCookies();
      await page.goto("/chats");
      await expect(page).toHaveURL(/\/login/);
    });

    await test.step("AC-26: an unauthenticated user hitting /settings is redirected to /login", async () => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login/);
    });

    test.fixme(
      true,
      "AC-25 (a single shared TanStack Query client instance used by all remotes) " +
        "is an internal wiring detail of the host app with no behavior " +
        "distinguishable from the outside via the UI.",
    );
  });

  test("US-9: Microfrontend failure isolation", async ({ page }) => {
    await registerAndLogin(page, freshUser("shell-isolation"));

    await test.step("AC-27: a scoped error state renders when the chat remote fails to load", async () => {
      // Force every remoteEntry/federated chunk request to fail, simulating a
      // remote that cannot be fetched, then try to enter the chat domain.
      await page.route(/remoteEntry|mfe-chat/i, (route) => route.abort());
      await page.goto("/chats");

      await expect(
        page.getByRole("alert").or(page.getByText(/couldn't load|failed to load|unavailable/i)),
      ).toBeVisible();
    });

    await test.step("AC-28: navigation and the rest of the app still work", async () => {
      await page.unroute(/remoteEntry|mfe-chat/i);
      await page.goto("/settings");
      await expect(page.locator("main, form")).toBeVisible();
    });

    // AC-29 is satisfied by this test itself: it simulates a remote load
    // failure and asserts the shell degrades gracefully instead of crashing.
  });
});
