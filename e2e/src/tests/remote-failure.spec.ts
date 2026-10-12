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
        const { path, ready } = remotes[remote];
        await failRemote(page, remote, mode);

        await test.step(`the ${remote} page shows the scoped fallback`, async () => {
          await page.goto(path);
          const fallback = fallbackOf(page, remote);
          await expect(fallback).toBeVisible();
          await expect(fallback).toHaveRole("alert");
          await expect(fallback.getByRole("button", { name: "Retry" })).toBeVisible();
          await expect(page.getByTestId(ready)).toHaveCount(0);
          await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        });

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
