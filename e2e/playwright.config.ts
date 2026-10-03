import { defineConfig, devices } from "@playwright/test";

/**
 * Base URL of the deployed shell app under test. The orchestrator (and the
 * `e2e` factory command) inject this as `BASE_URL`; it falls back to a local
 * `docker compose up` / dev-preview default for running the suite by hand.
 */
const baseURL = process.env["BASE_URL"] ?? "http://localhost:4173";

const isCI = !!process.env["CI"];

// The factory `e2e` command invokes `playwright test --reporter=junit`,
// which replaces the `reporter` array below entirely and drops any
// `outputFile` option configured here. The junit reporter itself still
// honors `PLAYWRIGHT_JUNIT_OUTPUT_FILE` at report-build time, so set a
// default here (without clobbering an explicit override) to guarantee the
// JUnit XML lands where the orchestrator expects it.
if (!process.env["PLAYWRIGHT_JUNIT_OUTPUT_FILE"]) {
  process.env["PLAYWRIGHT_JUNIT_OUTPUT_FILE"] = "/app/e2e-results.xml";
}

export default defineConfig({
  testDir: "./src/tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // UC6 (parallel-sessions) needs several concurrent streams from a single
  // worker's browser contexts, and UC7 (isolation) needs two independent
  // browser contexts in the same test — keep worker count modest so the
  // shared docker-compose stack (single Ollama instance) isn't overloaded.
  workers: isCI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "/app/e2e-results.xml" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
