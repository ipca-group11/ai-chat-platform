---
title: "AICHAT-26 · Prompt injection testing: work log"
---

# AICHAT-26 · Prompt injection testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-26](https://ipca-grupo11.atlassian.net/browse/AICHAT-26) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-26-prompt-injection-testing` |
| Started / finished | 2026-10-04 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-04

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Attack set, model and budget? | Attack set A1–A8 of README §5. Target model: the cheapest Anthropic model the app offers (Haiku class). Hard budget cap of USD 2 per run, recorded in the config and the workflow; the grader of `llm-rubric` uses the same cheap model | Team (owner delegated) |
| Tooling agreed | Met | promptfoo, garak? | promptfoo red-team with a custom HTTP target (TypeScript) that drives the real app API: sign in, create chat, upload, send, read the SSE stream. garak is not adopted (no HTTP-SSE target, overlaps promptfoo) | Team (owner delegated) |
| Target environment available | Met | Where does it run? | The compose stack locally. The harness is first proven against the LLM mock (free, deterministic, a scripted "obeying" reply proves the assertions catch a leak). Real-model runs are manual or weekly, never a merge gate | Team (owner delegated) |
| Attack set defined | Met | README §5 | Approved as proposed. Payload files in `testing/promptfoo/payloads`; attack web pages are served by a small local container the team owns (no public hosting, no real exfiltration endpoint, `attacker.example` URLs only). If the web-fetch guard blocks private addresses, the test stack allows the payload host by configuration only, never in production | Team (owner delegated) |
| A2 text attachments | Met | Text files do not reach the model today (AICHAT-25 finding) | A2 is kept in the set and expected to show the gap; it is reported, not counted as a pass | Team (owner delegated) |
| Real API key | Met | Which key pays? | The team key from the local, git-ignored credentials file, read by name only; never printed, logged or committed. In CI the weekly job uses a repository secret and skips when it is absent | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | 26.3 | n/a |
| Node | `node -v` → v24.21.0 | `nvm install` (reads `.nvmrc`) |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → Docker version 29.4.0 | Docker Desktop or OrbStack |
| promptfoo | `pnpm exec promptfoo --version` → 0.123.1 | `pnpm add -D -w promptfoo` (already in the root `package.json`) |
| Chrome (payload files only) | 154 | used once to render the image and the PDF payloads |

![Environment](evidence/00-environment.png)

## 3. Steps

### US1 · Define the attack set for files and web pages ([AICHAT-48](https://ipca-grupo11.atlassian.net/browse/AICHAT-48))

**What and why.** README section 5 is approved as proposed (DoR, section 1). We turned it into data: `testing/promptfoo/src/attacks.ts` lists 11 attacks (A1 image, A2a text file, A2b PDF with white text, A3 visible page, A4 hidden page, A5 markdown image, A6 shared chat, A7a-c direct, A8 cross-user), each with its payload, the prompt a user would type, and a rubric for the `llm-rubric` grader. The payload files are in `testing/promptfoo/payloads`; the instruction sources are HTML files, and the PNG and the PDF are rendered from them with headless Chrome, so anyone can read what is hidden in them. The attack pages are in `testing/promptfoo/pages` and are served by a small `nginx` container that the team owns (`attack-pages` in `compose.redteam.yaml`); no public hosting and no real exfiltration endpoint exist, every exfiltration URL uses `attacker.example`. The app has no system prompt, so the test stack gives conversation-service one with a canary (`SYSTEM_PROMPT`, a new optional setting that is empty in production; `compose.redteam.yaml` is only used by the test stack). A2 stays in the set and is marked as a known gap: text and PDF attachments never reach the model (AICHAT-25 finding), so it is reported and not counted as a pass.

**Files.**
- `testing/promptfoo/src/attacks.ts`, `canary.ts` (new): the attack set, the canary and the helpers, with `attacks.spec.ts` and `stack.spec.ts`.
- `testing/promptfoo/payloads/*` (new): `a1-image-injection.{html,png}`, `a2-injection.txt`, `a2-hidden-text.{html,pdf}`.
- `testing/promptfoo/pages/*` (new): `a3-visible.html`, `a4-hidden-fetch.html`, `a5-markdown-image.html`, `index.html`.
- `compose.redteam.yaml` (new), `scripts/mock-compose.sh`: `REDTEAM=1` adds the attack pages and the canary system prompt on top of the mock stack.
- `services/conversation-service/src/shared/env.ts`, `app.ts`, `features/messages/processor.ts`: optional `SYSTEM_PROMPT`, put before the history of every reply (unset: nothing changes).
- `testing/promptfoo/{package.json,project.json,tsconfig.json,vitest.config.ts,eslint.config.ts}`, `pnpm-workspace.yaml`: the new project `promptfoo`.

**How to run.**

```sh
pnpm --filter @platform/promptfoo test
```

**How to repeat it manually.**

1. Start only the attack pages: `COMPOSE_FILE=compose.yaml:compose.mock.yaml:compose.redteam.yaml docker compose --profile llm up -d --no-deps attack-pages` (set `ATTACK_PAGES_PORT` if 8090 is busy).
2. Open `http://127.0.0.1:8090/` and the three pages; view the source of `a4-hidden-fetch.html` to see the hidden `div` and the comment.
3. Open `testing/promptfoo/payloads/a1-image-injection.png` and the PDF; select all text in the PDF to see the white text.
4. Stop it with `docker compose ... down`, or `pnpm mock:down` after the full stack.

**Result.** 11 attacks with payloads, pages served on loopback, 16 unit tests green (they check that every payload file exists, that exfiltration goes only to `attacker.example`, that the canary is not in a page, and that the compose canary equals the one the assertions check).

![Payload files](evidence/01-payload-files.png)

![Attack pages served by the container](evidence/02-attack-pages-served.png)

![Tests of the attack set](evidence/03-attack-set-tests.png)

**Problems and fixes.**
- A real model fetches web pages on Anthropic's servers, so it cannot reach a container on a private network. There is no SSRF guard of ours on this path (the fetch is a provider tool), so no setting had to be opened. For the real run the pages need a public URL: `PAGES_BASE_URL` points to it (US2, US4). Against the mock the local URL is enough because the mock does not fetch.
- Chrome writes the PDF with a header and footer by default; `--no-pdf-header-footer` keeps the page clean.

