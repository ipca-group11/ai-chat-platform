---
title: "AICHAT-30 · [Foundations] SBOM generation"
---

# AICHAT-30 · [Foundations] SBOM generation

| Field | Value |
|---|---|
| Jira | [AICHAT-30](https://ipca-grupo11.atlassian.net/browse/AICHAT-30) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Depends on | AICHAT-7 (container image scanning, João Delgado): image list |
| Consumed by | AICHAT-6 (SCA) and AICHAT-7 (container scanning) |

## 1. Goal

Generate a **Software Bill of Materials** (the list of every package in each image) for **every image at build
time**, attach it as an **artifact**, and make it the input for SCA (AICHAT-6) and container scanning (AICHAT-7).

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** 10 built images + `postgres` and `caddy` confirmed in scope
- [ ] **Tooling agreed:** Syft + BuildKit attestations confirmed; format chosen (CycloneDX and/or SPDX)
- [ ] Target environment available
- [x] Image list from AICHAT-7 → **known from `deploy.yml`, §4**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the deploy
- [ ] Run instructions documented
- [ ] SBOM generated for every image at build and attached as an artifact
- [ ] Used by SCA (AICHAT-6) and container scanning (AICHAT-7)

## 3. Technologies

| Tool | Role |
|---|---|
| **Syft** (Anchore) / `anchore/sbom-action` | Generates SBOMs from images or directories in **SPDX JSON** or **CycloneDX JSON**; uploads as a workflow artifact |
| **BuildKit SBOM attestation** (`docker/build-push-action` `sbom: true`, `provenance: mode=max`) | Attaches an SPDX SBOM and SLSA provenance to the image in GHCR (inspect with `docker buildx imagetools inspect --format '{{json .SBOM}}'`) |
| **Grype** (Anchore) | Scans an SBOM for CVEs (`grype sbom:./x.spdx.json`); natural consumer |
| **Trivy** (AICHAT-7) | Can scan an SBOM too (`trivy sbom x.cdx.json`) |
| `actions/upload-artifact@v4` | Keeps SBOMs with the run |
| Formats | **CycloneDX JSON** (best supported by Trivy/Grype/Dependency-Track) and/or **SPDX 2.3 JSON** (ISO standard, what BuildKit emits) |

Recommendation: **both** BuildKit attestation (SBOM travels with the image) **and** Syft CycloneDX files as artifacts (easy to download and feed to Trivy/Grype).

## 4. Discovery: current state

- `.github/workflows/deploy.yml` builds and pushes **10 images** with `docker/build-push-action@v6` (matrix), `platforms: linux/amd64`, tags `:<sha>` and `:latest`:
  `auth-service`, `conversation-service`, `mfe-auth`, `mfe-chat`, `mfe-settings`, `shell`, `prometheus`, `grafana`, `loki`, `alloy`.
- **Neither `sbom:` nor `provenance:` is set**, so only Buildx's default minimal provenance is produced; no SBOM attestation; no signing; no scanning.
- Third-party images used in production without a build: `postgres:16-alpine`, `caddy:2-alpine` (also need SBOMs if AICHAT-7 scans them).
- Images are pushed **before** any check, so a scan gate (AICHAT-7) would need either a build → scan → push order or a "scan before deploy" step.
- `permissions: packages: write, contents: read` only. Attestations to GHCR need no extra permission; `actions/attest-sbom` (GitHub artifact attestations) would need `id-token: write` and `attestations: write`, and is limited on private repos depending on the plan.

## 5. Implementation plan (steps)

1. Agree on format(s) (CycloneDX + SPDX) and where SBOMs live (workflow artifacts, 90 days, plus image attestations).
2. In `deploy.yml` `build` job: set `sbom: true` and `provenance: mode=max` on `build-push-action`.
3. Add `anchore/sbom-action` after the push: `image: ghcr.io/…/<name>:<sha>`, `format: cyclonedx-json`, `artifact-name: sbom-<name>.cdx.json`.
4. Add a matrix entry, or a separate step, for the third-party images `postgres:16-alpine` and `caddy:2-alpine`.
5. **Hand-off to AICHAT-6/7:** Trivy/Grype read the SBOM (`trivy sbom`, `grype sbom:`), with severity threshold from AICHAT-7. Agree on the interface with João Delgado (artifact name pattern).
6. Optional: also produce a source-level SBOM of the pnpm workspace (`syft dir:. -o cyclonedx-json`) in `ci.yml` for SCA on PRs.
7. Check: download an artifact, open it, confirm package counts look right; `docker buildx imagetools inspect` shows the attestation.
8. Document: where to find the SBOMs, how to scan one locally.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-41](https://ipca-grupo11.atlassian.net/browse/AICHAT-41) | AICHAT-30-US1 | As a security owner, I want an agreed SBOM format and storage so that the scanners can use it | Decision (CycloneDX + SPDX, artifacts + attestation) recorded | 1 |
| [AICHAT-53](https://ipca-grupo11.atlassian.net/browse/AICHAT-53) | AICHAT-30-US2 | As an operator, I want each built image to carry an SBOM and provenance attestation | `sbom: true`, `provenance: mode=max` in `deploy.yml`; `imagetools inspect` shows them | 2 |
| [AICHAT-70](https://ipca-grupo11.atlassian.net/browse/AICHAT-70) | AICHAT-30-US3 | As a security owner, I want a downloadable CycloneDX SBOM per image for every deploy | 10 (+2 third-party) `sbom-*.cdx.json` artifacts per run | 2 |
| [AICHAT-88](https://ipca-grupo11.atlassian.net/browse/AICHAT-88) | AICHAT-30-US4 | As the SCA/container-scan owner, I want to scan the SBOMs so that CVE checks reuse them | Trivy/Grype step (AICHAT-7) consumes the artifacts; interface agreed with João Delgado | 2 |
| [AICHAT-108](https://ipca-grupo11.atlassian.net/browse/AICHAT-108) | AICHAT-30-US5 | (Optional) As a developer, I want a source SBOM of the pnpm workspace on PRs | `syft dir:.` in `ci.yml`, artifact uploaded | 1 |

## 7. Risks and open decisions

- SBOM by itself doesn't block anything; the **gate is in AICHAT-6/7**. Coordinate the order (build → SBOM → scan → push/deploy).
- Base images (`node:*-alpine`) dominate the package count; make sure Syft includes OS packages (apk) and npm packages.

## 8. Notes for the report

The deploy pipeline builds and pushes 10 images with **no SBOM and only minimal provenance**. An SBOM is not a test by
itself: it is the **input** that lets SCA and container scanning (another team member's epics) run without rebuilding. The plan
turns on BuildKit SBOM/provenance attestations and adds Syft CycloneDX artifacts per image, including the third-party
Postgres and Caddy images.
