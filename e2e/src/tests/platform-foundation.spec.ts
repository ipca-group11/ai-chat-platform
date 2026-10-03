import { expect, test } from "@playwright/test";

/**
 * platform-foundation stories (docs/BACKLOG.json). This pod's acceptance
 * criteria are almost entirely build-time/monorepo-tooling concerns (Nx
 * project graph, pnpm workspaces, shared configs, CI caching) that have no
 * observable behavior in a *running, deployed* instance of the app reachable
 * only via BASE_URL. Where a criterion has a runtime-observable consequence
 * (the compose stack actually being up), this suite checks it directly; the
 * rest is verified by the pod's own unit/build tooling (`nx affected -t lint
 * typecheck test build`), not by hitting the deployed app.
 */

test.describe("platform-foundation", () => {
  test("US-1: Monorepo setup with Nx and pnpm workspaces", async () => {
    test.fixme(
      true,
      "AC-1..AC-4 describe pnpm-workspace.yaml, the Nx project graph, per-project " +
        "Nx targets, and Nx tag boundaries: static, build-time properties of the " +
        "source repository with no observable behavior via the deployed app at " +
        "BASE_URL. Verified by `nx graph` / `nx affected -t lint typecheck test " +
        "build` in CI, not by an e2e test.",
    );
  });

  test("US-2: Docker Compose local development environment", async ({ page, request }) => {
    // AC-5: a single `docker compose up` starts every app/service — the one
    // runtime-observable consequence from the outside is that the shell
    // (and, transitively, the domains it lazy-loads) actually responds at
    // BASE_URL once the stack is up.
    await test.step("AC-5: the shell app served by the compose stack responds", async () => {
      const response = await request.get("/");
      expect(response.ok()).toBeTruthy();
      await page.goto("/");
      await expect(page).not.toHaveTitle("");
    });

    test.fixme(
      true,
      "AC-6 (Prometheus/Grafana pre-wired) and AC-7 (.env.example covering every " +
        "service) are not reachable/observable from the shell's BASE_URL: " +
        "Prometheus/Grafana run on their own ports not exposed to this suite, and " +
        ".env.example is a repository file, not a deployed HTTP surface.",
    );
  });

  test("US-3: Shared libraries: shared-types, eslint-config, tsconfig", async () => {
    test.fixme(
      true,
      "AC-8..AC-11 (shared-types contracts, eslint-config, tsconfig bases, " +
        "feature-folder import boundaries) are source-level/build-time properties " +
        "verified by `tsc --noEmit` and `eslint` in each project's own `lint`/" +
        "`typecheck` Nx targets, not by requests against the deployed app.",
    );
  });

  test("US-4: CI pipeline with nx affected", async () => {
    test.fixme(
      true,
      "AC-12..AC-14 describe the CI pipeline's use of `nx affected` and its cache, " +
        "which only exists during the build/CI process itself and has no runtime " +
        "surface on the deployed app to assert against here.",
    );
  });
});
