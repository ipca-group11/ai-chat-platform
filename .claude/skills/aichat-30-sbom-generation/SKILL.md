---
name: aichat-30-sbom-generation
description: Run epic AICHAT-30 (SBOM generation) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-30", "work on AICHAT-30", "continue AICHAT-30".
---

# AICHAT-30 · [Foundations] SBOM generation

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-30. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-30 · [Foundations] SBOM generation |
| Branch | `test/AICHAT-30-sbom-generation` |
| Work log | `docs/AICHAT-30/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-30/evidence/` |
| Depends on | AICHAT-7 (container image scanning, João Delgado): image list |

## Goal

Generate a **Software Bill of Materials** (the list of every package in each image) for **every image at build
time**, attach it as an **artifact**, and make it the input for SCA (AICHAT-6) and container scanning (AICHAT-7).

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-30/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-30/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-30/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-30/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: 10 built images + `postgres` and `caddy` confirmed in scope
2. Tooling agreed: Syft + BuildKit attestations confirmed; format chosen (CycloneDX and/or SPDX)
3. Target environment available
4. Image list from AICHAT-7 → known from `deploy.yml`, §4

Open decisions from the analysis (ask the ones not already settled):
  - SBOM by itself doesn't block anything; the **gate is in AICHAT-6/7**. Coordinate the order (build → SBOM → scan → push/deploy).
  - Base images (`node:*-alpine`) dominate the package count; make sure Syft includes OS packages (apk) and npm packages.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-41 | Agree SBOM format and storage | 1 | Decision (CycloneDX + SPDX, artifacts + attestation) recorded |
| AICHAT-53 | SBOM and provenance attestation on every built image | 2 | `sbom: true`, `provenance: mode=max` in `deploy.yml`; `imagetools inspect` shows them |
| AICHAT-70 | Downloadable CycloneDX SBOM per image for every deploy | 2 | 10 (+2 third-party) `sbom-*.cdx.json` artifacts per run |
| AICHAT-88 | Vulnerability scan of the SBOMs | 2 | Trivy/Grype step (AICHAT-7) consumes the artifacts; interface agreed with João Delgado |
| AICHAT-108 | Source SBOM of the pnpm workspace on PRs | 1 | `syft dir:.` in `ci.yml`, artifact uploaded |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the deploy
- [ ] Run instructions documented
- [ ] SBOM generated for every image at build and attached as an artifact
- [ ] Used by SCA (AICHAT-6) and container scanning (AICHAT-7)
