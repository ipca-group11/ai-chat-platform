---
name: bdd-playwright-e2e
description: Use when the user gives a BDD / Gherkin feature (Feature, Background, Scenario, Scenario Outline, e.g. the output of bdd-jira-story) and wants it implemented as a Playwright end-to-end test in the `e2e` project of this platform, or asks for "the e2e test" / "the Playwright test" of a feature or its acceptance criteria.
---

# Gherkin feature to Playwright e2e test

## Overview
The input is a Gherkin feature; the output is one Playwright spec in `e2e/src/tests/` that mirrors it line by line.
Page elements are found only through `data-testid`. A test that fails because the app is wrong stays red and is reported.

## Gherkin to Playwright mapping
| Gherkin | Playwright |
|---|---|
| `Feature:` | `test.describe("<feature name>")`, file `e2e/src/tests/<feature>.spec.ts` |
| `Background:` | `test.beforeEach`, one `test.step` per Given |
| `Scenario:` | one `test("<scenario name with its AC ids>")` |
| each Given / When / Then / And line | one `test.step("<the line, with its values>")`, same order, same wording |
| `Scenario Outline` + `Examples` | an array of rows and a `for` loop; the row value goes in the test title |
| `@api` (or any tag) | `test(name, { tag: "@api" }, …)`; uses the `request` fixture and the database, not the page |
| `{randomUser}` or other placeholder | a unique value per run (`randomUUID()`) |

No Cucumber or `playwright-bdd` dependency: the spec is plain `@playwright/test`. Steps repeated across scenarios become small functions that contain the `test.step` calls.

## Test ids
- Every element the test touches or reads is found with `page.getByTestId(...)`. No `getByRole`, `getByLabel`, `getByText` or CSS selectors. URLs are checked with `expect(page).toHaveURL(...)`.
- Before writing the spec, grep the feature's components (`apps/<mfe>/src/features/<feature>/components/`) for `data-testid`. Add the missing ones to the app: kebab-case, named after the element (`email`, `password`, `create-account`, `email-error`, `register-error`).
- `Input`, `Button` and `Alert` from `@app/ui` forward `data-testid`. The error text of `FormField` takes `errorTestId`. If another `@app/ui` component renders the element itself, add a similar optional prop.
- Expected texts in the assertions are the quoted strings of the Gherkin, unchanged.

## Step recipes
| Step | How |
|---|---|
| "I am not logged in" | `context.clearCookies()` |
| "an account already exists" / "I registered with" | `request.post("<E2E_AUTH_URL>/auth/register", { data: { email, password } })`, default URL `http://localhost:4001`. Accept 201 or 409 when only the email matters; when the scenario also depends on the password or on the response, delete the row first and expect 201 |
| "I am on the page" | `page.goto` plus one visible element of that page |
| "I am redirected to" | `toHaveURL` with a regex on the path of the Gherkin |
| "no request is sent to the server" | collect `page.on("request")` matches for the endpoint before acting; assert the list is empty |
| "I stay on the page" | `toHaveURL` plus one visible element of that page |
| database lookups, "no new account is created" | `e2e/src/tests/support/db.ts`: `psql` through `docker exec` in the postgres container (`E2E_POSTGRES_CONTAINER`, default `llm-chat-postgres-1`; Postgres is not published to the host). Table names are quoted and schema-qualified: `auth."User"`. Values go in as psql variables (`:'email'`), read from stdin |
| fixed emails in an `@api` scenario | the database outlives a run: delete the row first, then create it |

Helpers that are not specs live in `e2e/src/tests/support/`. The project is NodeNext ESM: import them with the `.js` extension (`./support/db.js`).

## Running
1. The stack is the compose project `llm-chat` (`docker ps`); the app is `http://localhost:8000`.
2. App changes need an image rebuild, from the repo root: `docker compose -f compose.yaml up -d --build --wait --no-deps <service>`. The service has the folder's name (`apps/mfe-auth` is `mfe-auth`). The build takes whatever is in the working tree, including changes that are not yours.
   - A change in `packages/ui` needs the **shell** rebuilt: `@app/ui` is a Module Federation singleton that the shell provides.
   - Without `--no-deps`, rebuilding the shell also rebuilds and recreates every service it depends on.
3. Run from `e2e/`: `PLAYWRIGHT_JUNIT_OUTPUT_FILE=test-results/junit.xml pnpm exec playwright test --project=chromium --reporter=list --timeout=20000` (the default 60 s timeout makes a red run take minutes; without the variable the JUnit reporter writes to `/app`, which does not exist on the host).
4. On a failure read `e2e/test-results/<test>/error-context.md`: it holds the page snapshot.
5. Run the suite a second time (leftover data), then `pnpm exec tsc -p tsconfig.json --noEmit` (in `e2e/`) and `pnpm exec nx run e2e:lint`.

## When a test fails because of the app
If the page shows something other than the Gherkin says (wrong message, wrong redirect), find the cause in the code, leave the test as written, and report it to the user with the file and the reason. Changing app behaviour needs the user's approval; adding `data-testid` does not.

## Common mistakes
| Mistake | Fix |
|---|---|
| `getByLabel` / `getByRole` "because the label is in the Gherkin" | Add a `data-testid` and use `getByTestId` |
| Several Gherkin lines merged in one step, or steps reworded | One `test.step` per line, same text |
| Expected text adjusted to what the app shows | Keep the Gherkin text; report the defect |
| Test id added but "element not found" | The image was not rebuilt, or the change is in `@app/ui` and the shell was not rebuilt |
| `psql -c` with `-v` variables | `-c` does not interpolate; pass the SQL on stdin |
| Second run fails with 409 | Unique data per run, or delete the fixed row first |
