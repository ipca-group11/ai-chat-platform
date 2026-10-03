---
title: "AICHAT-21 · [Foundations] Performance testing (frontend)"
---

# AICHAT-21 · [Foundations] Performance testing (frontend)

| Field | Value |
|---|---|
| Jira | [AICHAT-21](https://ipca-grupo11.atlassian.net/browse/AICHAT-21) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-22 (bundle size), observability (Faro + Grafana) |
| Layer | Frontend (Core Web Vitals) |

## 1. Goal

Keep each page within agreed **Core Web Vitals** budgets: **LCP** (Largest Contentful Paint), **INP** (Interaction to
Next Paint), **CLS** (Cumulative Layout Shift). Use **Lighthouse CI** in the pipeline (lab data) and **Grafana Faro** in
production (field / real-user data).

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** 5 pages confirmed in scope: `/login`, `/register`, `/chats`, `/chats/:id`, `/settings`
- [ ] **Tooling agreed:** Lighthouse CI for lab data (TBT as INP proxy) and Faro/Grafana for field data confirmed
- [ ] Target environment available
- [ ] LCP / INP / CLS budgets agreed per page → **proposal in §5**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Lighthouse CI checks every page against the budgets
- [ ] Faro real-user vitals visible in Grafana

## 3. Technologies

| Tool | Role | Notes |
|---|---|---|
| **Lighthouse CI** (`@lhci/cli`) | Runs Lighthouse N times per URL, asserts budgets, uploads reports | `lighthouserc.cjs` with `assert.assertions` |
| Lighthouse `budget.json` / `assertions` | `largest-contentful-paint`, `cumulative-layout-shift`, `total-blocking-time`, `interactive`, resource sizes | Lighthouse can't measure INP in lab runs (no real interaction), so **TBT is the lab proxy for INP** |
| Puppeteer login script (`puppeteerScript`) | Logs in before auditing authenticated pages (`/chats`, `/settings`) | LHCI supports a puppeteer script hook |
| **Grafana Faro Web SDK** `@grafana/faro-web-sdk ^2.12.1` | Real-user Web Vitals (LCP, INP, CLS, TTFB, FCP) | Already initialised in `apps/shell/src/shared/observability/faro.ts` |
| Grafana Alloy (`faro.receiver`) → Loki → Grafana | Stores and shows RUM data | `observability/alloy.alloy`, dashboard `frontend-faro.json` |
| GitHub Actions | Runs LHCI against the compose stack | Reuses the `e2e.yml` stack startup |

Alternative: Playwright + `web-vitals` library for INP with scripted interactions (could complement LHCI for INP).

## 4. Discovery: current state

- **No Lighthouse or LHCI config** in the repo.
- **Faro is already initialised** (`initFaro` in the shell) with `getWebInstrumentations({ captureConsole: true })`. The default web instrumentations include the Web Vitals instrumentation. It is only active when `VITE_FARO_URL` is set at build time (compose: `http://localhost:12347/collect`; Azure: `https://$DOMAIN/collect`).
- **The Grafana dashboard already has LCP, INP, CLS and TTFB p75 panels** (`observability/grafana/provisioning/dashboards/frontend-faro.json`, Loki `quantile_over_time` over `kind="measurement" type="web-vitals"`). So the "Faro vitals visible in Grafana" DoD item is mostly **verify and document**, not build.
- Pages are served by `vite preview` from built `dist/` (shell :8000, remotes :3001-3003 in `compose.yaml`).
- Micro-frontend effect: each page loads the shell + `remoteEntry.js` + remote chunks from a second origin. Bundle data from AICHAT-22 discovery: shell ~241 KB gzip JS, each remote 135–167 KB gzip, and **each remote bundles its own react-dom (208 KB raw)**, which likely hurts LCP.
- Fonts load from Google Fonts with `display=swap`, a possible CLS and LCP cost.
- Faro has **no `beforeSend` scrubbing** and page URLs contain chat ids (see AICHAT-32).

## 5. Proposed budgets (to agree, DoR)

Based on Google's "good" thresholds, made stricter for the simple pages:

| Page | LCP (lab) | TBT (lab, INP proxy) | CLS | INP (field p75) |
|---|---|---|---|---|
| `/login`, `/register` | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 200 ms |
| `/chats` | ≤ 2.5 s | ≤ 300 ms | ≤ 0.1 | ≤ 200 ms |
| `/chats/:id` | ≤ 2.5 s | ≤ 300 ms | ≤ 0.1 | ≤ 200 ms |
| `/settings` | ≤ 2.5 s | ≤ 300 ms | ≤ 0.1 | ≤ 200 ms |

Lab runs use the Lighthouse desktop preset and median-of-3 runs to reduce noise.

## 6. Implementation plan (steps)

1. Agree on the budgets in §5 (DoR).
2. Add `lighthouserc.cjs` at the repo root: `collect.url` for the 5 pages, `numberOfRuns: 3`, `settings.preset: "desktop"`, `puppeteerScript: ./testing/lighthouse/login.cjs` (registers/logs in a test user).
3. Write `assert.assertions` per URL pattern (`assertMatrix`) with the budgets.
4. CI: new job in `e2e.yml` (after the stack is healthy) or a separate `perf-frontend.yml`: `npx @lhci/cli autorun`; reports uploaded as an artifact (`target: filesystem`) or to temporary public storage.
5. Make the job a required check (repo admin action).
6. Faro: check that web-vitals measurements reach Loki on the deployed VM; screenshot the dashboard; add per-page breakdown (`page_url` label) if missing.
7. Write `docs/AICHAT-21/RUNNING.md`: run LHCI locally against `docker compose up`, read the report.
8. Feed findings back: e.g. share react-dom properly between remotes, self-host fonts, preload `remoteEntry.js`.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-45](https://ipca-grupo11.atlassian.net/browse/AICHAT-45) | AICHAT-21-US1 | As a team, I want agreed LCP/INP/CLS budgets per page so that "fast enough" is defined | Budgets table approved and recorded here | 1 |
| [AICHAT-62](https://ipca-grupo11.atlassian.net/browse/AICHAT-62) | AICHAT-21-US2 | As a developer, I want Lighthouse CI to audit every page, including logged-in pages, so that I see performance per PR | `lighthouserc.cjs` + login script; 5 URLs audited ×3 runs locally | 3 |
| [AICHAT-80](https://ipca-grupo11.atlassian.net/browse/AICHAT-80) | AICHAT-21-US3 | As a team, I want CI to fail when a page goes over budget so that regressions can't be merged | LHCI job in GitHub Actions with assertions; reports kept as an artifact; failing assertion fails the job | 3 |
| [AICHAT-98](https://ipca-grupo11.atlassian.net/browse/AICHAT-98) | AICHAT-21-US4 | As an operator, I want to see real-user Web Vitals per page in Grafana so that I know how the deployed app performs | Faro dashboard shows LCP/INP/CLS p75 from the VM, broken down by page; documented with a screenshot | 2 |
| [AICHAT-115](https://ipca-grupo11.atlassian.net/browse/AICHAT-115) | AICHAT-21-US5 | As a developer, I want a list of performance improvements from the first audit so that the budgets can be met | Findings list (shared deps, fonts, preloading) linked to follow-up tickets | 2 |

## 8. Risks and open decisions

- **INP can't be measured by Lighthouse navigation runs.** TBT is used as the CI proxy; INP is only checked from Faro field data.
- CI runners are noisy: use median of 3 runs and some margin; consider `assert` as `warn` first, then `error` once stable.
- Authenticated pages need a seeded user; reuse the `e2e/src/fixtures/test-users.ts` approach.

## 9. Notes for the report

Field monitoring is **already in place** (Faro → Alloy → Loki → Grafana dashboard with LCP/INP/CLS p75 panels).
What's missing is the **lab gate**: no Lighthouse runs and no agreed budgets. Discovery also found likely performance
costs specific to the micro-frontend design (react-dom duplicated in each remote bundle, extra origin round-trips for
`remoteEntry.js`, Google-hosted fonts). The plan adds Lighthouse CI with TBT as the lab proxy for INP.
