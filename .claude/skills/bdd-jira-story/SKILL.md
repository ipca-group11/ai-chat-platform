---
name: bdd-jira-story
description: Use when the user wants a feature, use case or user story of this platform (e.g. "registration", UC1, US-11, FR4) written as BDD / Gherkin test scenarios and set as a Jira issue title and description, or asks for "the test steps in Jira" for a feature.
---

# BDD Jira story for a feature

## Overview
Turn one feature into a Jira issue whose description holds Gherkin scenarios that a tester can run as written.
Every expected message, label and route is copied from the code, never invented.

## Sources (read in this order)
| What | Where |
|---|---|
| FR / UC text | `docs/SPEC.md` (sections 4 and 5) |
| Story and AC ids | `docs/BACKLOG.json` (`pods[].stories[]` with `id` US-n, `acceptanceCriteria[]` with `id` AC-n) |
| UI labels, routes, client messages | `apps/<mfe>/src/features/<feature>/components/*.tsx`, `apps/<mfe>/src/shared/schemas.ts`, `apps/shell/src/routes/` |
| Server rules and messages | `services/<service>/src/features/<feature>/model.ts`, `services/<service>/src/shared/contracts/` |
| Already-tested behaviour | `*.spec.ts(x)` next to the code, `e2e/src/tests/` |

If the client and server messages differ, or the spec and code disagree, use the text the user sees in the UI in the scenarios and record the difference under **Notes**.

## Scope
One issue = the feature's UC plus the FRs it names. Behaviour that belongs to a neighbouring feature (logout in a login story, the route guard, cookie flags) goes under **Notes** as "separate ticket" suggestions. It is never added as a scenario. If the feature name matches more than one UC or story, ask which one.

## Output contract
**Title:** `UC<n> – <Feature name>` (use `US-<n>` when there is no UC). Keep it to 60 characters or fewer, with no outcomes.

**Description**, these parts in this order:
1. **User story**: As a … / I want … / So that …
2. **Covers**: FR, UC, US and AC ids.
3. **Rules**: 2–4 one-line facts from the code (for example the password policy, uniqueness, hashing).
4. **Gherkin** in one code block:
   - A `Feature:` line, then a `Background:` holding the shared Givens. Scenarios never repeat them.
   - Each scenario has exactly one `When` behaviour (a `When` plus `And` steps that fill one form is fine). Its name ends with the AC id when one exists: `Scenario: Duplicate email is rejected (AC-31)`.
   - Input variations of the same rule use one `Scenario Outline` with `Examples`.
   - Steps use the visible labels and quote exact UI text: `I click "Create account"`, `I see the error "…"`.
   - Each negative scenario also asserts the side effect (stays on the page, no request sent, no account created).
   - Server or database checks that the UI cannot show get the `@api` tag.
5. **Notes**: spec/code mismatches, client/server message differences, separate-ticket suggestions. Leave this part out when there is nothing to note.

Jira text follows the repo's Authorship rule (see `epic-workflow`): team voice, and it never mentions AI, assistants or generated content.

## Workflow
1. Gather facts from the sources above.
2. Show the user the title and description in chat. Then ask for:
   - the issue type
   - the parent epic (or none)
   - whether this is a new issue or an update to an existing key
3. Before creating, search for duplicates: `searchJiraIssuesUsingJql` with `project = AICHAT AND summary ~ "<feature>"`. If one exists, offer to update it.
4. Write to Jira **only after the user explicitly approves**, using the Atlassian MCP tools:
   - cloudId `436aa6ed-4a2a-4c54-b40f-3490773ebd63`, project `AICHAT`
   - `createJiraIssue` for a new issue, `editJiraIssue` for an update
   - the description goes in as **ADF**, because the markdown converter breaks code blocks and lists
   - if `createJiraIssue` does not accept an ADF description, create the issue with the summary only. Then set the description with `editJiraIssue`, `fields: {"description": <ADF>}`.
5. Reply with the issue key and its URL: `https://ipca-grupo11.atlassian.net/browse/<KEY>`.

The ADF root is `{"version":1,"type":"doc","content":[...]}`. The Gherkin part is:
```json
{"type":"codeBlock","attrs":{"language":"gherkin"},"content":[{"type":"text","text":"Feature: User registration\n\n  Background:\n    ..."}]}
```
Headings are `{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"User story"}]}`. Plain lines are `paragraph` nodes.

## Common mistakes
| Mistake | Fix |
|---|---|
| Message text paraphrased or taken from the spec | Copy it from `schemas.ts` / `model.ts` / the component |
| Several When/Then pairs in one scenario | Split them, or use a Scenario Outline |
| Background Givens repeated inside scenarios | Keep them only in Background |
| Adjacent features added "for completeness" | Move them to Notes as separate tickets |
| Long title listing the outcomes | `UC<n> – <Feature name>` |
| Wiki markup or markdown description | ADF |
| Creating the issue before the user approves | Draft first, then wait for explicit approval |
