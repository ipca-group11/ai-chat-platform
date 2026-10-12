import type { Page } from "@playwright/test";
import { expect, test } from "./support/auth.js";
import { failRemote, remoteNames, remotes, type RemoteName } from "./support/remote-faults.js";

/**
 * AICHAT-8: one Module Federation remote fails or is slow, and the shell keeps working.
 *
 * Every test signs in first (the `account` fixture uses the login page, so `mfeAuth` must still
 * be up at that point), then breaks one remote with `failRemote` and loads the pages again.
 */

/** Opens the page that mounts `remote` the way a user would: the nav link when there is one. */
async function open(page: Page, remote: RemoteName) {
  const navLink = { mfeChat: "nav-chats", mfeSettings: "nav-settings" } as const;
  if (remote === "mfeAuth") await page.goto(remotes[remote].path);
  else await page.getByTestId(navLink[remote]).click();
  await expect(page).toHaveURL(new RegExp(`${remotes[remote].path}$`));
}

function fallbackOf(page: Page, remote: RemoteName) {
  return page.getByTestId(`remote-fallback-${remotes[remote].scope}`);
}

test.describe("AICHAT-162: each remote down in turn shows only its own fallback", () => {
  for (const remote of remoteNames) {
    for (const mode of ["abort", "http-500"] as const) {
      test(`${remote} ${mode}: fallback with Retry, nav bar stays, the other remotes still work`, async ({
        page,
        account,
      }) => {
        void account;
        const created = await page.request.post("/api/chats", {
          data: { title: "Remote failure", provider: "anthropic", model: "claude-haiku-4-5" },
        });
        expect(created.status()).toBe(201);
        const { id: chatId } = (await created.json()) as { id: string };
        const pagesOf: Record<RemoteName, string[]> = {
          mfeAuth: ["/login", "/register"],
          mfeChat: ["/chats", `/chats/${chatId}`],
          mfeSettings: ["/settings"],
        };
        await failRemote(page, remote, mode);

        for (const path of pagesOf[remote]) {
          await test.step(`${path} shows the scoped fallback`, async () => {
            await page.goto(path);
            const fallback = fallbackOf(page, remote);
            await expect(fallback).toBeVisible();
            await expect(fallback).toHaveRole("alert");
            await expect(fallback.getByRole("button", { name: "Retry" })).toBeVisible();
            await expect(page.getByTestId(remotes[remote].ready)).toHaveCount(0);
            await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
          });
        }

        for (const other of remoteNames.filter((name) => name !== remote)) {
          await test.step(`${other} still works while ${remote} is down`, async () => {
            await open(page, other);
            await expect(page.getByTestId(remotes[other].ready)).toBeVisible();
            await expect(page.locator("[data-testid^=remote-fallback-]")).toHaveCount(0);
          });
        }
      });
    }
  }
});

test.describe("AICHAT-163: a slow remote shows the skeleton, a hung one times out", () => {
  for (const remote of remoteNames) {
    const { path, scope, ready } = remotes[remote];

    test(`${remote} slow: skeleton under the nav bar, then the content, no fallback`, async ({ page, account }) => {
      void account;
      await failRemote(page, remote, { delayMs: 1500 });
      await page.goto(path);

      const skeleton = page.getByTestId(`remote-loading-${scope}`);
      await expect(skeleton).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByTestId(ready)).toBeVisible({ timeout: 30_000 });
      await expect(skeleton).toHaveCount(0);
      await expect(fallbackOf(page, remote)).toHaveCount(0);
    });

    test(`${remote} never answers: the other pages do not wait for it`, async ({ page, account }) => {
      void account;
      await failRemote(page, remote, "hang");

      for (const other of remoteNames.filter((name) => name !== remote)) {
        await test.step(`${other} renders while ${remote} hangs`, async () => {
          await page.goto(remotes[other].path);
          await expect(page.getByTestId(remotes[other].ready)).toBeVisible();
        });
      }
    });

    test(`${remote} never answers: its page shows the fallback after the load timeout`, async ({
      page,
      account,
    }) => {
      void account;
      await failRemote(page, remote, "hang");
      await page.goto(path);

      await expect(page.getByTestId(`remote-loading-${scope}`)).toBeVisible();
      // The shell gives up after 15 s (REMOTE_LOAD_TIMEOUT_MS in loadRemote.ts).
      await expect(fallbackOf(page, remote)).toBeVisible({ timeout: 25_000 });
      await expect(page.getByTestId(`remote-loading-${scope}`)).toHaveCount(0);
    });
  }
});
