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

/** Creates a chat through the shell's `/api` proxy and returns its id. */
async function createChat(page: Page, title: string): Promise<string> {
  const created = await page.request.post("/api/chats", {
    data: { title, provider: "anthropic", model: "claude-haiku-4-5" },
  });
  expect(created.status()).toBe(201);
  return ((await created.json()) as { chat: { id: string } }).chat.id;
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
        const chatId = await createChat(page, "Remote failure");
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
      // 500 ms per file: the remote loads a chain of ~6 files, so it stays well under the 15 s timeout.
      await failRemote(page, remote, { delayMs: 500 });
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

test.describe("AICHAT-164: Retry loads the remote again once it is back, without a reload", () => {
  /** A reload clears `window`; the marker proves the page was never reloaded. */
  const markPage = (page: Page) => page.evaluate(() => ((window as { noReload?: boolean }).noReload = true));
  const pageWasKept = (page: Page) => page.evaluate(() => (window as { noReload?: boolean }).noReload === true);

  for (const remote of remoteNames) {
    const { path, ready } = remotes[remote];

    test(`${remote}: Retry while down shows the fallback again, Retry once back shows the remote`, async ({
      page,
      account,
    }) => {
      void account;
      const fault = await failRemote(page, remote, "abort");
      await page.goto(path);
      const fallback = fallbackOf(page, remote);
      await expect(fallback).toBeVisible();
      await markPage(page);

      await test.step("Retry while the remote is still down", async () => {
        // Retry must ask the remote again, not replay a load the runtime cached.
        const fetched = page.waitForRequest((request) => request.url().startsWith(remotes[remote].origin), {
          timeout: 10_000,
        });
        await fallback.getByRole("button", { name: "Retry" }).click();
        await fetched;
        await expect(fallback).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      });

      await test.step("Retry once the remote is back", async () => {
        await fault.restore();
        await fallback.getByRole("button", { name: "Retry" }).click();
        await expect(page.getByTestId(ready)).toBeVisible();
        await expect(fallback).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        expect(await pageWasKept(page)).toBe(true);
      });
    });
  }

  test("mfeChat: Retry after the load timeout recovers once the remote answers", async ({ page, account }) => {
    void account;
    const fault = await failRemote(page, "mfeChat", "hang");
    await page.goto("/chats");
    const fallback = fallbackOf(page, "mfeChat");
    await expect(fallback).toBeVisible({ timeout: 25_000 });
    await markPage(page);

    await fault.restore();
    await fallback.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("new-chat")).toBeVisible();
    expect(await pageWasKept(page)).toBe(true);
  });
});

test.describe("AICHAT-165: a remote's chunks fail after its remoteEntry.js has loaded", () => {
  for (const remote of remoteNames) {
    const { path, scope, origin } = remotes[remote];

    test(`${remote}: entry loads, chunks fail: fallback, logged with the scope, no uncaught error`, async ({
      page,
      account,
    }) => {
      void account;
      const consoleErrors: string[] = [];
      const pageErrors: Error[] = [];
      page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
      page.on("pageerror", (error) => pageErrors.push(error));
      await failRemote(page, remote, "abort", "chunks");

      const entry = page.waitForResponse(`${origin}/remoteEntry.js`);
      await page.goto(path);
      expect((await entry).status()).toBe(200);

      await expect(fallbackOf(page, remote)).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect(consoleErrors).toContainEqual(expect.stringContaining(`[remote-loader] remote "${scope}" failed:`));
      expect(pageErrors).toEqual([]);
    });
  }

  test("mfeChat goes down mid-session: the loaded code keeps working until a reload", async ({ page, account }) => {
    void account;
    const first = await createChat(page, "First");
    const second = await createChat(page, "Second");
    await page.goto("/chats");
    await expect(page.getByTestId("new-chat")).toBeVisible();
    await page.waitForLoadState("networkidle");

    let requestsWhileDown = 0;
    page.on("request", (request) => request.url().startsWith(remotes.mfeChat.origin) && requestsWhileDown++);
    const fault = await failRemote(page, "mfeChat", "abort");

    await test.step("moving between chats and pages works from the code already loaded", async () => {
      for (const id of [first, second]) {
        await page.getByTestId(`chat-item-${id}`).click();
        await expect(page).toHaveURL(new RegExp(`/chats/${id}$`));
        await expect(page.getByTestId("message-input")).toBeVisible();
      }
      await page.getByTestId("nav-settings").click();
      await expect(page.getByTestId("settings-heading")).toBeVisible();
      await page.getByTestId("nav-chats").click();
      await expect(page.getByTestId("new-chat")).toBeVisible();
      await expect(fallbackOf(page, "mfeChat")).toHaveCount(0);
      expect(requestsWhileDown).toBe(0);
    });

    await test.step("a reload needs the remote again: fallback, then Retry once it is back", async () => {
      await page.reload();
      await expect(fallbackOf(page, "mfeChat")).toBeVisible();
      await fault.restore();
      await fallbackOf(page, "mfeChat").getByRole("button", { name: "Retry" }).click();
      await expect(page.getByTestId("new-chat")).toBeVisible();
    });
  });
});
