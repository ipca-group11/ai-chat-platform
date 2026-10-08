import { defineConfig, devices } from "@playwright/test";

/**
 * Base URL of the deployed shell app under test. The orchestrator (and the
 * `e2e` factory command) inject this as `BASE_URL`; it falls back to a local
 * `docker compose up` / dev-preview default for running the suite by hand.
 */
const baseURL = process.env["BASE_URL"] ?? "http://localhost:8000";

const isCI = !!process.env["CI"];

// Where the JUnit XML lands. The orchestrator sets `PLAYWRIGHT_JUNIT_OUTPUT_FILE`
// (to `/app/e2e-results.xml` inside its container); everywhere else — a laptop
// or a GitHub runner — `/app` does not exist and the reporter would fail the
// run with ENOENT after every test passed, so default to a repo-relative path.
const junitFile = process.env["PLAYWRIGHT_JUNIT_OUTPUT_FILE"] ?? "test-results/e2e-results.xml";

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
    ["junit", { outputFile: junitFile }],
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
