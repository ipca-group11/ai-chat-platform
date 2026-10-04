---
title: "AICHAT-19 · Visual regression testing: work log"
---

# AICHAT-19 · Visual regression testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-19](https://ipca-grupo11.atlassian.net/browse/AICHAT-19) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-19-visual-regression-testing` |
| Started / finished | 2026-10-04 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-04

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which screens? | The 9 key screens of README §4.4 × light and dark at 1280×800 desktop = 18 baselines | Team (owner delegated) |
| Tooling agreed | Met | Tool, and how are fonts made stable? | Playwright `toHaveScreenshot` in a separate `visual` project, run only inside the Playwright Docker image (Linux, same as CI). Fonts: intercept the Google Fonts requests in the visual tests only and serve local font files; no app change here, because self-hosting is tracked in AICHAT-230 | Team (owner delegated) |
| Target environment available | Met | Does it need the compose stack? | No. The built shell and remotes are served statically and every API call is mocked with fixed JSON and a frozen clock, so the run is short and independent of the backend. The slow e2e suite stays disabled (owner decision 2026-10-03); only the `visual` project runs | Team (owner delegated) |
| Key screens listed | Met | README §4.4 | Login, login with validation error, register, chat list empty, chat list with chats, chat detail with messages, new chat dialog, settings / API keys, remote failure fallback | Team (owner delegated) |
| Fixed fonts and data | Met | Not met before this epic (README §4.2) | Delivered by AICHAT-39: local fonts, API mocks, frozen clock, animations off; proven by 10 identical runs | Team (owner delegated) |
| CI trigger | Met | When does the visual job run? | Own workflow `visual.yml` on pull requests to `integration/testing-epics` and `main` when files under `apps/`, `packages/ui` or the visual tests change, plus manual runs; a diff fails the job and the diff images are uploaded | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| <tool for this epic> | … | … |

## 3. Steps

### US1 · <story summary> ([AICHAT-<key>](https://ipca-grupo11.atlassian.net/browse/AICHAT-<key>))

**What and why.** …

**Files.**
- `path/to/file` (new): …

**How to run.**

```sh
<one command from the repo root>
```

**How to repeat it manually.**

1. …
2. …
3. Expected output: …

**Result.** …

![<caption>](evidence/01-<what>.png)

**Problems and fixes.** …

### US2 · …

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| … | … | … |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
