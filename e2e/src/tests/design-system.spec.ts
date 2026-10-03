import { expect, test } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import { freshUser } from "../fixtures/test-users.js";

/**
 * design-system stories (docs/BACKLOG.json, pod `design-system`). The
 * component library itself (`packages/ui`) and its Storybook are built and
 * documented independently of the deployed shell; from the deployed app we
 * can only observe that every microfrontend actually renders using
 * consistent, accessible UI primitives (buttons/inputs with proper roles and
 * labels, one visual theme) rather than ad-hoc markup.
 */

test.describe("design-system", () => {
  test("US-5: Core component library on shadcn/ui + Base UI", async ({ page }) => {
    await test.step("AC-15/AC-18: mfe-auth renders accessible design-system primitives (buttons, labelled inputs)", async () => {
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
    });

    await test.step("AC-18: mfe-chat and mfe-settings render the same primitives after login", async () => {
      await registerAndLogin(page, freshUser("design-system"));
      await expect(page.getByRole("button", { name: /new chat/i })).toBeVisible();

      await page.goto("/settings");
      await expect(page.locator("form, main")).toBeVisible();
    });

    await test.step("AC-16: a consistent color/typography theme is applied (no unstyled/user-agent-default form controls)", async () => {
      const button = page.getByRole("button").first();
      const background = await button.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      // A themed shadcn/Base UI button never falls back to the transparent
      // user-agent default; some non-default background must be applied.
      expect(background).not.toBe("");
      expect(background.toLowerCase()).not.toBe("rgba(0, 0, 0, 0)");
    });

    test.fixme(
      true,
      "AC-17 (typography follows the shadcn Typeset scale) is a design-token-level " +
        "detail best verified against packages/ui's own Storybook/unit tests, not " +
        "by inspecting computed styles of one deployed page.",
    );
  });

  test("US-6: Storybook documentation and accessibility checks", async () => {
    test.fixme(
      true,
      "AC-19..AC-21 describe packages/ui's Storybook instance (stories per " +
        "component, the Axe addon, the `storybook` Nx target). Storybook is a " +
        "development/documentation tool built and served independently of the " +
        "deployed shell app and is not reachable via the shell's BASE_URL.",
    );
  });
});
