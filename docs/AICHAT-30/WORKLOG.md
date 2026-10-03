---
title: "AICHAT-30 · SBOM generation: work log"
---

# AICHAT-30 · SBOM generation: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-30](https://ipca-grupo11.atlassian.net/browse/AICHAT-30) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-30-sbom-generation` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which images? | The 10 images built in `deploy.yml` plus the third-party `postgres:16-alpine` and `caddy:2-alpine`, and a source SBOM of the pnpm workspace on pull requests | Team (owner delegated) |
| Tooling agreed | Met | Tool and format? | BuildKit attestations (`sbom: true`, `provenance: mode=max`) on every pushed image, and Syft (`anchore/sbom-action`) for downloadable CycloneDX JSON artifacts (`sbom-<name>.cdx.json`, 90 days); SPDX stays in the BuildKit attestation. Syft must list OS (apk) and npm packages | Team (owner delegated) |
| Target environment available | Met | Where can we prove it without deploying? | Locally with Docker buildx and a local `registry:2`, so `imagetools inspect` shows the attestations; the deploy workflow is not run against Azure by this epic | Team (owner delegated) |
| Image list from AICHAT-7 | Met | Is the list known? | Yes, from the `deploy.yml` build matrix (README §4); no wait on AICHAT-7 | Team (owner delegated) |
| Scan hand-off (AICHAT-6/7) | Met | Who gates? | The SBOM does not block anything by itself. We agree the interface (artifact name `sbom-<name>.cdx.json`, CycloneDX JSON) and add a Grype step that reads the artifacts and reports; the severity threshold that fails the build belongs to AICHAT-7 and is recorded in the hand-off note for that team | Team (owner delegated) |

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
