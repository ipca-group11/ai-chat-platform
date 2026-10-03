import { expect, test } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import { createChat, messagesLog, sendMessage, waitForStreamToFinish } from "../fixtures/chat-flows.js";
import { freshUser } from "../fixtures/test-users.js";

/** quality-observability stories (docs/BACKLOG.json, pod `quality-observability`). */

test.describe("quality-observability", () => {
  test("US-27: Structured logging with correlation IDs", async ({ request }) => {
    await test.step("AC-88: every request to the services is tagged with a correlation id, propagated from the caller", async () => {
      const correlationId = `e2e-${Date.now()}`;
      const response = await request.get("/api/chats", {
        headers: { "x-correlation-id": correlationId, "x-request-id": correlationId },
      });
      const headers = response.headers();
      const echoed = Object.entries(headers).find(([name]) =>
        /correlation-id|request-id|trace-id/i.test(name),
      );
      expect(echoed?.[1] ?? "").toContain(correlationId);
    });

    test.fixme(
      true,
      "AC-89 (structured JSON logs including the correlation id) and AC-90 " +
        "(secrets redacted from log output) describe the *content* of log files " +
        "produced by auth-service/conversation-service, which are not exposed over " +
        "HTTP to this suite; verified by the services' own logger unit tests and " +
        "log-inspection in their CI jobs.",
    );
  });

  test("US-28: Metrics and Grafana dashboards", async () => {
    test.fixme(
      true,
      "AC-91..AC-93 (Prometheus scraping, a preconfigured Grafana dashboard, both " +
        "starting via `docker compose up`) live on Prometheus'/Grafana's own ports, " +
        "not on the shell's BASE_URL, and aren't reachable from this suite.",
    );
  });

  test("US-29: Testing strategy: unit, contract, and performance tests", async () => {
    test.fixme(
      true,
      "AC-94..AC-97 (Vitest unit tests, Pact contract tests, a K6 performance test, " +
        "documented/enforced coverage targets) describe other test suites and CI " +
        "gates in the repository, not runtime behavior of the deployed app; " +
        "verified by running those suites themselves, not by e2e.",
    );
  });

  test("US-30: End-to-end coverage of UC1-UC8", async ({ page }) => {
    // AC-98 is satisfied by this suite as a whole (auth.spec.ts / chat.spec.ts /
    // configuration.spec.ts exercise UC1-UC8); this test is a broad smoke path
    // touching register -> login -> create chat -> send -> stream in one go as
    // an extra end-to-end signal that the whole flow works together.
    await test.step("AC-98: a full UC1-UC3 happy path works end-to-end", async () => {
      await registerAndLogin(page, freshUser("e2e-coverage"));
      await createChat(page);
      await sendMessage(page, "End-to-end smoke check");
      await waitForStreamToFinish(page);
      await expect(messagesLog(page).getByTestId("assistant-message").last()).not.toHaveText("");
    });

    test.fixme(
      true,
      "AC-99 (Axe checks run with no critical violations as part of e2e/Storybook " +
        "CI) and AC-100 (the e2e suite runs in CI and gates merges) describe the " +
        "CI wiring around this suite (see .factory/commands.json's `e2e` command), " +
        "not additional runtime behavior of the deployed app to assert here.",
    );
  });
});
