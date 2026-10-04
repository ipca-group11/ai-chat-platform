# Triage of the first SBOM scan (AICHAT-236)

Local re-scan, 2026-10-04: Syft (CycloneDX) and Grype 0.120.0, vulnerability database built 2026-10-04 08:11 UTC. The first scan is in [sbom-summary.md](sbom-summary.md). Counts change with the database of the day.

## Scope of the re-scan

| Artifact | Re-scanned | How |
|---|---|---|
| `sbom-source.cdx.json` (pnpm workspace) | Yes | Syft on a clean `git archive HEAD`, as in CI; then again after the fix below |
| `sbom-postgres.cdx.json` (`postgres:16-alpine`) | Yes | Latest `16-alpine` pulled on 2026-10-04 |
| Node images (auth-service, conversation-service, shell, three MFEs) | No | Not run locally: Docker off (the ten image builds take close to an hour, WORKLOG §4). The first scan found 0 Critical in all of them |
| Go images and `caddy:2-alpine` | No | Not run locally: Docker off. 0 Critical in the first scan |

## Critical findings

| # | Artifact | Package | Finding | Decision | Result |
|---|---|---|---|---|---|
| 1, 2 | source SBOM | `vitest` 2.1.9, in `packages/ui/pnpm-lock.yaml` and `packages/shared-types/pnpm-lock.yaml` | GHSA-5xrq-8626-4rwp (Vitest UI server reads and runs arbitrary files), fixed in 3.2.6 | **Fixed.** These two files, and `apps/mfe-chat/pnpm-lock.yaml`, are stale lockfiles left from the first commit. pnpm uses only the root `pnpm-lock.yaml` in a workspace (it resolves `vitest` 5.0.1, which is not affected), but Syft reads every lockfile in the tree, so the source SBOM listed packages that are never installed. The three files were deleted | 0 Critical; the source SBOM drops from 3175 to 2180 components and from 33 to 24 High |
| 3 | `postgres:16-alpine` | Go `stdlib` go1.24.6 in `/usr/local/bin/gosu` | GO-2026-4337 / CVE-2025-68121, `crypto/tls` session resumption accepts a changed CA set, fixed in Go 1.24.13 | **Exception** in [`.grype.yaml`](../../../.grype.yaml). gosu only drops root and execs `postgres` when the container starts; it opens no TLS connection, so the flaw cannot be reached. The fix needs an upstream rebuild of the image: the `16-alpine` tag pulled on 2026-10-04 still ships go1.24.6. Postgres itself (and its TLS, OpenSSL) is not affected | Grype with `-c .grype.yaml` lists it under ignored matches; 0 Critical left |

## The severity gate

Grype now runs with `-c .grype.yaml --fail-on critical`:

- `ci.yml`, job `source-sbom`: on every pull request, after Syft writes `sbom-source.cdx.json`. A Critical in the workspace dependencies fails the job.
- `deploy.yml`, job `scan-sbom`: the report step still writes every finding to the job summary and never fails; a second step fails the job when any of the 12 image SBOMs has a Critical that `.grype.yaml` does not accept. `deploy` now waits for `scan-sbom`, so such an image is not rolled out.

High and lower findings are reported, not blocking. Each exception in `.grype.yaml` names the vulnerability, the package, its location and the reason; the structural test (`e2e/src/ci/sbom-workflow.spec.ts`) fails if a rule has no reason.

Local proof of the gate (exit 2 is Grype's "severity threshold reached"):

```text
postgres  no config       exit=2 | Critical 1, High 24, Low 2, Medium 23 | ignored: none
postgres  -c .grype.yaml  exit=0 | High 24, Low 2, Medium 23             | ignored: GO-2026-4337 (Critical)
source    before the fix  exit=2 | Critical 2, High 33, Low 8, Medium 33 | ignored: none
source    after the fix   exit=0 | High 24, Low 5, Medium 15             | ignored: none
```

## High findings

**postgres:16-alpine: 24 High.** 23 are Go `stdlib` (go1.24.6) advisories in the same `gosu` binary (fixed in Go 1.25.x/1.26.x); same reasoning as the Critical: gosu does no networking or parsing of untrusted input. One is `zlib` 1.3.2-r0 (CVE-2026-85091), with no fixed Alpine package yet. All wait for an upstream image rebuild; re-check on the next scan.

**Workspace (source SBOM): 24 High**, all in development and test tooling, none in a library the services call at runtime:

| Package | Advisories | Fixed in | Pulled in by |
|---|---|---|---|
| `axios` 1.18.1 | 7 (SSRF via redirects, ReDoS, prototype pollution, HTTP/2 DoS) | 1.20.0 | `nx`, `@pact-foundation/pact` (contract tests) |
| `adm-zip` 0.6.0 | 4 (DoS, SUID bits on extraction) | 0.6.1 | `@module-federation/dts-plugin` (build), `onnxruntime-node`, both dev dependencies |
| `undici` 7.29.0 | 2 (WebSocket DoS, TLS validation bypass in balanced pool) | 7.29.1 | `promptfoo` (red-team tests) |
| `brace-expansion` 5.0.9, `braces` 3.0.3 | 3 (stack exhaustion DoS) | 5.0.11 / none | build tooling (globbing) |
| `extract-zip` 2.0.1 | 2 (symlink path traversal) | none | `@puppeteer/browsers` (browser download for Lighthouse) |
| `tmp` 0.0.33, 0.1.0 | 2 (path traversal via prefix) | 0.2.6 | `@lhci/cli` |
| `node-forge` 1.4.0 | 1 (RSA signature check) | none | `jks-js`, a dev dependency |
| `basic-ftp` 5.3.1 | 1 (quadratic DoS) | 6.2.1 | `get-uri` (proxy agent of the browser tooling) |
| `smol-toml` 1.6.1 | 1 (DoS on malformed TOML) | 1.7.1 | `nx` |
| `actions/download-artifact` v4 | 1 (arbitrary file write on extraction) | 4.1.3 | `deploy.yml`; `@v4` already resolves to the latest 4.x on the runner, Grype only sees the major tag |

**Node images: 20 High (services) and 26 High (shell and MFEs) in the first scan.** They are the same npm packages as above plus a few Alpine packages, because the runtime images copy the whole workspace `node_modules` (WORKLOG §7). Pruning dev dependencies from the runtime images would remove most of them; that is follow-up work, not part of this triage.

## Follow-up

- Re-scan the 12 images when Docker is available, with the gate (`--fail-on critical -c .grype.yaml`), and update this file.
- Bump `axios`, `undici`, `brace-expansion`, `smol-toml` and `tmp` when their parents allow it (or through `pnpm.overrides`), and prune dev dependencies from the Node runtime images.
- Remove the `gosu` exception when a `postgres:16-alpine` rebuild ships Go 1.24.13 or later.
