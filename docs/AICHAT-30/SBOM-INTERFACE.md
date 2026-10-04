---
title: "AICHAT-30 · SBOM interface for the vulnerability scan (AICHAT-6/7)"
---

# SBOM interface for the vulnerability scan

Hand-off note for the team that owns the Trivy/Grype gate (AICHAT-7, João Delgado). We could not agree this in a meeting, so it is written down; tell us if a name or a place has to change.

## What exists

| Item | Value |
|---|---|
| Format | CycloneDX JSON (`format: cyclonedx-json`), made by Syft through `anchore/sbom-action` |
| Where | Artifacts of the `deploy` workflow run (Actions → run → Artifacts). The run page lists them; `actions/download-artifact` with `pattern: sbom-*.cdx.json` fetches them all |
| Retention | 90 days |
| Content | OS packages (`apk`) and npm packages of the image, with purl and version |
| Also | Each pushed image carries an SPDX SBOM and SLSA provenance as BuildKit attestations: `docker buildx imagetools inspect <image> --format '{{ json .SBOM }}'` |

Artifact names (one per image, 12 per deploy run):

| Built by us (10) | Third party (2) |
|---|---|
| `sbom-auth-service.cdx.json`, `sbom-conversation-service.cdx.json` | `sbom-postgres.cdx.json` (`postgres:16-alpine`) |
| `sbom-mfe-auth.cdx.json`, `sbom-mfe-chat.cdx.json`, `sbom-mfe-settings.cdx.json`, `sbom-shell.cdx.json` | `sbom-caddy.cdx.json` (`caddy:2-alpine`) |
| `sbom-prometheus.cdx.json`, `sbom-grafana.cdx.json`, `sbom-loki.cdx.json`, `sbom-alloy.cdx.json` | |

On pull requests, `ci.yml` also uploads `sbom-source.cdx.json`: the npm packages of the pnpm workspace, read from the lockfile.

## How to scan

```sh
# Grype
grype sbom:./sbom-auth-service.cdx.json
grype sbom:./sbom-auth-service.cdx.json --fail-on high   # the form AICHAT-7 can use as a gate

# Trivy
trivy sbom ./sbom-auth-service.cdx.json --severity HIGH,CRITICAL --exit-code 1
```

## What is and is not decided

- The `scan-sbom` job in `deploy.yml` downloads the 12 artifacts and runs Grype on each one. The report step writes the table to the job summary and never fails.
- **Severity gate (AICHAT-236):** a second step runs `grype sbom:<file> -c .grype.yaml --fail-on critical` and fails the job on any Critical that `.grype.yaml` does not accept. `deploy` now has `scan-sbom` in its `needs`, so an image with an unaccepted Critical is not rolled out. `ci.yml` (`source-sbom`) applies the same gate to `sbom-source.cdx.json` on every pull request. High and lower are reported only.
- Exceptions live in `.grype.yaml` at the repo root, each with a `reason`; the triage is in [results/sbom-triage.md](results/sbom-triage.md).
- Choosing Trivy instead of Grype, or a stricter threshold, is still open to AICHAT-7; the artifact names above are the contract.
- Today the images are pushed before they are scanned (see the analysis, section 4). A scan before the push needs a build, scan, push order, which is also an AICHAT-7 decision.
