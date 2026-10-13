# e2e

Playwright end-to-end tests, run against the full Docker Compose stack with the mock LLM (`pnpm mock:up`). In CI they
run in `.github/workflows/e2e.yml` on every pull request and on pushes to `main`; a failing test fails the job.

## Run the suite

```sh
pnpm install --frozen-lockfile
pnpm --filter e2e exec playwright install chromium
pnpm mock:up                                  # builds and starts the stack (shell on :8000, remotes on :3001-3003)
AUTH_RATE_LIMIT_MAX=0 pnpm mock:up            # same, without the auth-service rate limit (as CI does)

cd e2e
ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test --project=chromium
pnpm exec playwright show-report              # HTML report of the last run
```

The suite sends more than the auth-service's default 300 requests per 15 minutes; without `AUTH_RATE_LIMIT_MAX=0`
sign-ins start failing with `429` after a few runs (`docker restart llm-chat-auth-service-1` resets the counter).

`pnpm mock:down` stops the stack.

## Remote failure and fallback (AICHAT-8)

`src/tests/remote-failure.spec.ts` breaks one Module Federation remote at a time and checks that only its part of the
page fails, that the loading skeleton and the load timeout work, and that Retry recovers the remote without a reload.
`src/tests/support/remote-faults.ts` provides the helper:

```ts
const fault = await failRemote(page, "mfeChat", "abort"); // or "http-500", { delayMs: 500 }, "hang"
await failRemote(page, "mfeChat", "abort", "chunks");     // remoteEntry.js loads, the other files fail
await fault.restore();                                     // the remote is back
```

It matches the remote's **origin** (`VITE_MFE_AUTH_URL`, `VITE_MFE_CHAT_URL`, `VITE_MFE_SETTINGS_URL`, defaults
`http://localhost:3001` to `3003`), so the other remotes and the shell's own `remoteEntry.js` are never touched.

```sh
cd e2e
pnpm exec playwright test src/tests/remote-failure.spec.ts --reporter=list          # ~3.5 min, needs the stack
pnpm exec playwright test src/tests/remote-failure.spec.ts -g AICHAT-164            # one story (162 to 165)
pnpm exec playwright test src/tests/support/remote-faults.spec.ts                   # matcher only, no stack needed
```

The tests need a shell image built from the same branch (`pnpm mock:up` rebuilds it). Details, evidence and the
defects found: `docs/AICHAT-8/WORKLOG.md`.

## Accessibility (AICHAT-10)

`src/tests/accessibility.spec.ts` opens 17 pages and UI states (forms with errors, chat history, a stopped and a failed
reply, dialogs, settings, the remote fallback) in the light and the dark theme and scans each one with axe-core
(`@axe-core/playwright`, WCAG 2.2 AA rules). A `serious` or `critical` violation fails the test. Each scan is saved as
JSON in `e2e/axe-report/`; CI uploads that folder as the `axe-report` artifact and writes a summary table to the job
summary.

`src/tests/keyboard-and-live-region.spec.ts` uses the keyboard only: login, register, create a chat, send, Stop, focus
inside the dialogs, focus ring in both themes, and checks that a streaming reply is announced once by a screen reader.

```sh
cd e2e
ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test src/tests/accessibility.spec.ts            # ~2 min
ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test src/tests/accessibility.spec.ts -g "dark"  # one theme
pnpm run --silent axe-summary                                                                                # last run
ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test src/tests/keyboard-and-live-region.spec.ts # ~45 s
```

In a test, `assertNoCriticalA11yViolations(page, testInfo, label)` from `src/tests/support/axe.ts` scans the page as it
is. Details, the matrix and the defects found: `docs/AICHAT-10/WORKLOG.md`.
