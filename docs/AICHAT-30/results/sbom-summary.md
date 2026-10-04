# SBOM package and vulnerability counts

Local run, 2026-10-03: images built for linux/arm64 and pushed to a local registry; SBOMs by Syft (CycloneDX 1.7), scan by Grype. The SBOM files themselves are not committed (about 25 MB). Counts depend on the vulnerability database of the day.

| Artifact | Components | apk | deb | npm | golang | Critical | High | Medium | Low | Grype total |
|---|---|---|---|---|---|---|---|---|---|---|
| `sbom-alloy.cdx.json` | 4013 | 0 | 95 | 0 | 1046 | 0 | 2 | 61 | 16 | 82 |
| `sbom-auth-service.cdx.json` | 2623 | 27 | 0 | 1223 | 0 | 0 | 20 | 20 | 1 | 41 |
| `sbom-caddy.cdx.json` | 406 | 32 | 0 | 0 | 148 | 0 | 1 | 4 | 0 | 6 |
| `sbom-conversation-service.cdx.json` | 2643 | 27 | 0 | 1233 | 0 | 0 | 20 | 20 | 1 | 41 |
| `sbom-grafana.cdx.json` | 2674 | 33 | 0 | 4 | 1710 | 0 | 11 | 5 | 3 | 24 |
| `sbom-loki.cdx.json` | 1321 | 0 | 6 | 0 | 368 | 0 | 0 | 3 | 4 | 8 |
| `sbom-mfe-auth.cdx.json` | 2523 | 18 | 0 | 1211 | 0 | 0 | 26 | 28 | 4 | 58 |
| `sbom-mfe-chat.cdx.json` | 2725 | 18 | 0 | 1312 | 0 | 0 | 26 | 28 | 4 | 58 |
| `sbom-mfe-settings.cdx.json` | 2511 | 18 | 0 | 1205 | 0 | 0 | 26 | 28 | 4 | 58 |
| `sbom-postgres.cdx.json` | 870 | 45 | 0 | 0 | 4 | 1 | 24 | 23 | 2 | 50 |
| `sbom-prometheus.cdx.json` | 444 | 0 | 0 | 0 | 439 | 0 | 3 | 0 | 0 | 5 |
| `sbom-shell.cdx.json` | 2571 | 18 | 0 | 1235 | 0 | 0 | 26 | 28 | 4 | 58 |
| `sbom-source.cdx.json` | 2323 | 0 | 0 | 2295 | 0 | 2 | 26 | 32 | 6 | 66 |

Triage of the Critical findings and the severity gate: [sbom-triage.md](sbom-triage.md) (AICHAT-236).
