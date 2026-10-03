# E2E suite (Playwright)

One test per user story of `docs/BACKLOG.json`, named `"<story id>: <story title>"`
(e.g. `US-11: Login and logout (FR2, UC2)`), covering that story's acceptance criteria
through the UI, or through the API for stories with no UI (see `src/tests/*.spec.ts`,
grouped one file per pod). Stories whose acceptance criteria are purely build-time/
tooling concerns with no observable behavior in a *running* deployed instance (e.g.
Nx workspace wiring, CI caching, Storybook, Prometheus/Grafana on their own ports) are
marked `test.fixme(...)` with an explanation instead of a fabricated assertion.

## Running

The suite reads the app URL from `BASE_URL` (no default assumed in CI; see
`.factory/commands.json`'s `e2e` entry, which runs this suite in the
`mcr.microsoft.com/playwright:v1.63.0-noble` image against the deployed app and expects
a JUnit report at `/app/e2e-results.xml`, produced automatically by
`playwright test --reporter=junit` plus the `PLAYWRIGHT_JUNIT_OUTPUT_NAME` env var the
orchestrator sets).

```bash
cd e2e
npm install
BASE_URL=http://localhost:4173 npx playwright test
```

`playwright.config.ts` falls back to `http://localhost:4173` when `BASE_URL` is unset,
for convenience when running locally against `docker compose up`.

This package is self-contained (plain `npm install`, no workspace-linked packages) since
the `e2e` factory command copies only this directory out of the monorepo.

Unit tests for the plain-TS fixture/a11y logic (not the browser specs themselves) run via
Vitest, as the Nx `test` target: `pnpm --filter e2e test`. That target's `vitest.config.ts`
only includes `src/fixtures/**/*.spec.ts`, `src/a11y/**/*.spec.ts`, and `src/ci/**/*.spec.ts`
— it never picks up the Playwright specs under `src/tests/`, so this suite stays out of the
repo-wide unit `test` run (`nx affected -t test`).

## Assumed UI contract (reconcile with `auth`/`chat`/`configuration`/`shell` pods at integration)

This suite is authored against the planned routes/accessible-name contract below, since
`apps/mfe-*` are owned and built independently by other pods. If the shipped markup uses
different labels/roles, update the shared helpers in `src/fixtures/*.ts` (single source of
truth for selectors) rather than each spec.

| Area | Route | Key elements (accessible name / role) |
|------|-------|----------------------------------------|
| Register | `/register` | `Email`, `Password` labelled fields; `Create account`/`Register` button; `alert` role for validation errors; redirects to `/login` on success |
| Login | `/login` | `Email`, `Password` labelled fields; `Log in`/`Sign in` button; `alert` role for a generic invalid-credentials error; redirects to `/chats` on success; `Log out`/`Sign out` button once logged in |
| Chat list | `/chats` | `New chat` button; `list` named "Chats" |
| Chat view | `/chats/:id` | textbox named `Message` (composer); `Send`/`Stop`/`Retry` buttons; `Rename`/`Delete` actions; `log` region named `Messages` containing `data-testid="user-message"` / `data-testid="assistant-message"` items; `status` role named "generating"/"streaming" while a response is in flight; queued messages show visible text "Queued" plus `Edit`/`Cancel` actions; `Attach a file` labelled file input; a provider/model `combobox` |
| Isolation | `/chats/:id` (other user) | heading `Not found`/`Forbidden`; API `GET /api/chats/:id` returns 403/404 for a non-owner |
| Settings | `/settings` | one labelled field per provider (e.g. `OpenAI API key`); `Save`/`Remove`/`Test connection` buttons; masked value display (e.g. `sk-…abcd`) |

## Notes

- Specs use fresh, timestamped emails per test run (`src/fixtures/test-users.ts`) so the
  suite can be re-run against a persistent stack without colliding with prior runs.
- `src/a11y/axe-helper.ts` fails a test on any `critical`/`serious` Axe violation; the
  pure filtering logic is unit-tested in `axe-helper.spec.ts`.
- `US-18`/`US-14` (`chat.spec.ts`) are the more expensive/flaky-prone tests (background
  streaming, multi-context); `playwright.config.ts` caps CI worker count and retries once
  to absorb stack warm-up flakiness without masking real failures.
