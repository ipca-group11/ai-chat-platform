---
title: "Execution plan for the testing epics (AICHAT-17 to AICHAT-34, AICHAT-144)"
---

# Execution plan

The order in which the 19 testing epics (125 stories, 320 points) are delivered, and the exact command that starts
each one. The process inside every epic is described in [EPIC-WORKFLOW.md](EPIC-WORKFLOW.md); the epic analyses are
indexed in [AICHAT-EPICS.md](AICHAT-EPICS.md).

## Principles behind the order

1. **Decide first, build later.** Every DoR decision that needs the team is taken in one session (wave 0), so no epic
   stops halfway waiting for an answer.
2. **Unblock others early.** The mock server (AICHAT-144) is the largest epic, but load, DAST, prompt injection,
   PII and the frontend tests all run against it, so it comes before them.
3. **Quality gate before tests.** Coverage thresholds (AICHAT-34) are set first, so every later test epic is
   measured against the same gate.
4. **Cheap security baseline early.** SAST and secret scanning have no blockers and find real defects (F1, a
   local `.env.credentials`) in the first days.
5. **Pentest last.** It is most useful once the automated tools have removed the easy findings.
6. **One epic In Progress at a time.** If an epic is blocked, it is flagged *Impediment* and the next one in the
   list starts.

## Branches

```
main
 └── integration/testing-epics                 ← final PR to main, reviewed by the team
      └── test/AICHAT-<n>-<short-name>          ← one per epic (all already on origin)
```

Before starting an epic, its branch picks up everything already merged:

```sh
git fetch origin
git switch test/AICHAT-<n>-<short-name>
git merge origin/integration/testing-epics
```

Every PR of the epic targets `integration/testing-epics`. After each wave, `main` is merged into the integration
branch (`git switch integration/testing-epics && git merge origin/main && git push`) so the final PR has no surprises.

## Wave 0: decisions (one team session, before any code)

Decisions taken by the owner on 2026-10-03:

| # | Decision | Epic | Answer |
|---|---|---|---|
| D1 | Coverage thresholds per project group, ratchet policy | 34 | README §5 proposal (services/packages 80/80/80/80, MFEs and shell 80/75/80/80, e2e helpers 80/70/80/80, k6 exempt); projects below it are ratcheted from their current value |
| D2 | Unit-test exempt list | 17 | README policy: bootstrap files, barrel `index` files and type-only modules, one reason each |
| D3 | Testability changes in app code (`createApp` DI, env-configurable LLM base URLs) | 23, 144, 24, 26 | Allowed: small, one commit and PR each, reviewed by the code owner |
| D4 | SAST and secret scanning tools | 27, 31 | Semgrep CE + gitleaks (free, in GitHub Actions) |
| D5 | LLM API keys and budget | 25, 26 | No paid API: recordings and red-team runs use local Ollama; OpenAI/Anthropic fixtures are written by hand from the provider docs |
| D6 | Bundle size limits and performance budgets | 22, 21 | Size limit = current gzip size + 10 %; Lighthouse performance ≥ 90, LCP < 2.5 s, CLS < 0.1 |
| D7 | Masking rule for emails and IPs | 32 | Email → short salted hash; IPv4 last octet zeroed |
| D8 | System prompt | 26 | Test-only canary system prompt, enabled by env; production unchanged |
| D9 | Fonts for visual tests | 19 | Self-hosted fonts |
| D10 | User deletion endpoint | 33 | Built inside AICHAT-33 as a testability change, reviewed by the backend owner; 30-day retention |
| D11 | Pentest environment | 29 | Local Docker compose stack only, no deployed target |

External dependencies to raise in the same session: **AICHAT-4** (E2E harness, João Delgado) for AICHAT-19,
**AICHAT-7** (image scanning, João Delgado) for AICHAT-30, and the **user deletion endpoint** for AICHAT-33.

The answers are recorded as a comment on each epic in Jira; the DoR review of each epic only confirms them.

## The path

| Step | Wave | Epic | Points | Why here | Needs before start |
|---|---|---|---|---|---|
| 1 | 1 · Foundations | AICHAT-34 Coverage thresholds | 11 | Gate the other epics are measured against | D1 |
| 2 | 1 · Foundations | AICHAT-31 Secret scanning | 10 | No blockers, real secret file present locally | D4 |
| 3 | 1 · Foundations | AICHAT-27 SAST | 10 | No blockers, finds the JWT default secret (F1) | D4 |
| 4 | 2 · Test infrastructure | AICHAT-25 Provider adapter testing | 13 | Produces the recorded LLM fixtures (from Ollama) the mock server replays | D5 |
| 5 | 2 · Test infrastructure | AICHAT-144 Mock server | 51 | Unblocks 24, 26, 28, 32 and frontend tests | D3 |
| 6 | 3 · Code quality | AICHAT-17 Unit testing | 47 | Base of the pyramid, provides shared test helpers | D2, step 1 |
| 7 | 3 · Code quality | AICHAT-18 Component testing | 14 | Uses the helpers from AICHAT-17 | step 6 |
| 8 | 3 · Code quality | AICHAT-23 Integration testing | 19 | Backend error paths | D3 |
| 9 | 3 · Code quality | AICHAT-20 Snapshot testing | 11 | Finds the SSE type drift (F12) | — |
| 10 | 4 · Running system | AICHAT-24 Load testing | 11 | Mock LLM now available | step 5 |
| 11 | 4 · Running system | AICHAT-28 DAST | 11 | ZAP against the e2e stack with mocks | step 5 |
| 12 | 4 · Running system | AICHAT-32 PII masking | 14 | Captures logs and telemetry from the running stack | D7 |
| 13 | 4 · Running system | AICHAT-30 SBOM generation | 8 | Plugs into the image build | AICHAT-7 image list |
| 14 | 5 · Frontend budgets | AICHAT-22 Bundle size budget | 10 | Static build check, quick | D6 |
| 15 | 5 · Frontend budgets | AICHAT-21 Performance testing | 11 | Lighthouse CI on the built frontends | D6 |
| 16 | 5 · Frontend budgets | AICHAT-19 Visual regression | 12 | Needs the e2e harness and stable fonts | D9, AICHAT-4 |
| 17 | 6 · Decisions and features | AICHAT-26 Prompt injection | 15 | Uses the mock server and the canary | D5, D8, step 5 |
| 18 | 6 · Decisions and features | AICHAT-33 GDPR retention and deletion | 24 | Needs the deletion endpoint | D10 |
| 19 | 6 · Decisions and features | AICHAT-29 Penetration testing | 18 | Last: tests everything above | D11, steps 3, 11, 17 |
| | | **Total** | **320** | | |

Points per wave: 31 · 64 · 91 · 44 · 33 · 57.

**If an epic is blocked** (most likely 30, 19, 33): flag it *Impediment*, take the next step, and come back to it
when the dependency is delivered. Steps inside the same wave can be swapped freely.

## Start commands (in order)

Each line is typed in Claude Code. After the epic's PRs are merged into the integration branch, tick the box and
move to the next line. To resume an epic that was interrupted, use `continue AICHAT-<n>` instead.

**Wave 0**
- [x] Hold the decision session (D1 to D11), record the answers in Jira

**Wave 1: foundations**
- [x] `start AICHAT-34`
- [x] `start AICHAT-31`
- [x] `start AICHAT-27`
- [x] Merge `main` into `integration/testing-epics` (nothing new on `main`)

**Wave 2: test infrastructure**
- [x] `start AICHAT-25`
- [x] `start AICHAT-144`
- [x] Merge `main` into `integration/testing-epics` (nothing new on `main`)

**Wave 3: code quality**
- [x] `start AICHAT-17`
- [x] `start AICHAT-18`
- [x] `start AICHAT-23`
- [x] `start AICHAT-20`
- [ ] Merge `main` into `integration/testing-epics`

**Wave 4: running system**
- [x] `start AICHAT-24`
- [x] `start AICHAT-28`
- [x] `start AICHAT-32`
- [x] `start AICHAT-30`
- [ ] Merge `main` into `integration/testing-epics`

**Wave 5: frontend budgets**
- [x] `start AICHAT-22`
- [x] `start AICHAT-21`
- [x] `start AICHAT-19`
- [ ] Merge `main` into `integration/testing-epics`

**Wave 6: decisions and features**
- [x] `start AICHAT-26`
- [x] `start AICHAT-33`
- [ ] `start AICHAT-29`

**Final**
- [x] `git switch integration/testing-epics && git merge origin/main`, run the full suite (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`)
- [ ] Open the PR `integration/testing-epics → main` listing every epic, its work log and its evidence folder
- [ ] Request review from the team; after approval, merge and move the remaining epics from **Review** to **Done**

## Checklist per epic (done when all are true)

- [ ] DoR answers recorded in `docs/AICHAT-<n>/WORKLOG.md` §1 and in a Jira comment
- [ ] Every story has its WORKLOG section, evidence in `docs/AICHAT-<n>/evidence/`, and a merged PR into the integration branch
- [ ] DoD table in the work log links evidence for every item
- [ ] Status updated in [AICHAT-EPICS.md](AICHAT-EPICS.md); epic moved to **Review** in Jira
