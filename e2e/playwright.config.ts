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
  // shared docker-compose stack (and the provider's rate limits) aren't overloaded.
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
    // Visual regression (AICHAT-19). Own folder, so `chromium` never runs these specs and this
    // project never runs the e2e specs. Serves the built apps itself and mocks every API call,
    // so it needs no stack and no BASE_URL. Baselines are only valid from the Playwright Docker
    // image (`pnpm --filter e2e visual`, see docs/AICHAT-19/RUNNING.md).
    {
      name: "visual",
      testDir: "./src/visual",
      // The Vitest specs of the helpers in lib/ are not Playwright specs.
      testIgnore: "**/lib/**",
      // One browser at a time: the specs share four fixed ports.
      fullyParallel: false,
      retries: 0,
      timeout: 30_000,
      snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
      expect: {
        toHaveScreenshot: {
          // Up to 1% of the pixels may differ (sub-pixel anti-aliasing); each pixel may differ a little.
          maxDiffPixelRatio: 0.01,
          threshold: 0.2,
          animations: "disabled",
          caret: "hide",
          scale: "css",
        },
      },
      use: {
        ...devices["Desktop Chrome"],
        // The shell, served by the spec itself.
        baseURL: "http://localhost:5000",
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        locale: "en-GB",
        timezoneId: "UTC",
        colorScheme: "light",
        launchOptions: {
          // Same pixels on a busy machine: software rendering on one raster thread, no LCD text, no font hinting.
          args: ["--disable-gpu", "--disable-lcd-text", "--font-render-hinting=none", "--force-color-profile=srgb", "--disable-skia-runtime-opts", "--num-raster-threads=1"],
        },
        screenshot: "off",
        video: "off",
        trace: "off",
      },
    },
  ],
});
