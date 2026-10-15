---
title: "AICHAT-7 · Container image scanning"
---

# Container image scanning (Trivy)

`deploy.yml` builds each of the 10 images into the runner's local Docker, scans it with Trivy **before** pushing to GHCR, and only then pushes. A HIGH or CRITICAL finding (fixed or not) fails the `build` job, so nothing is pushed and `deploy` does not run.

| Item | Value |
|---|---|
| Scanner | `aquasecurity/trivy-action` |
| Threshold | `HIGH,CRITICAL`, exit code 1 |
| Report | CI artifact `trivy-<image>.json`, 90 days (kept even when the scan fails) |
| Not scanned | `postgres` and `caddy` (third-party, not pushed to GHCR); the SBOM report in `scan-sbom` covers them without blocking |

## Run it by hand

```sh
docker build -f services/auth-service/Dockerfile -t scan/auth-service .
trivy image --severity HIGH,CRITICAL --exit-code 1 scan/auth-service
```

## When it blocks

Fix by upgrading the package or base image. If there is no fix yet, add the CVE id to a `.trivyignore` file at the repo root with a comment and expiry, and add `trivyignores: .trivyignore` to the scan step.
