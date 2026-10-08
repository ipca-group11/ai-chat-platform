# NFR test plan

Each item: key | category | requirement | threshold | tool | owns | run.
Only gaps and weak checks are planned. No browser e2e.

| key | category | threshold | tool | owns |
|---|---|---|---|---|
| perf-lh-a11y-extend | performance | FCP<=1800ms, TTFB<=600ms, total-byte-weight<=1.5MB, speed-index<=3400ms median | lighthouse-ci | lighthouserc.json |
| perf-lh-mobile | performance | mobile throttled: LCP<=4000ms, TBT<=600ms, CLS<=0.1 | lighthouse-ci | testing/lighthouse/** |
| perf-k6-ttft-spec | load | TTFT p95<1000ms at 5 streams | k6 | testing/k6/lib/scenarios.ts |
| perf-k6-gate | load | smoke: REST p95<1000ms, fail<1%, TTFT p95<1500ms, done>99% | k6+GH Actions | .github/workflows/load.yml |
| load-mixed | load | users+streams together: REST p95<1000ms, TTFT p95<1500ms | k6 | testing/k6/scenarios/** |
| load-soak-30 | load | 30 min @20 streams/s, mem growth <10%, done>99% | k6 + stats sampler | scripts/load/** |
| load-deploy-limits | load | deploy compose has mem+cpu limits on every service | vitest | deploy/azure/** |
| ui-5-streams | performance | 5 concurrent streams: 0 long tasks >200ms, jsdom render budget | vitest | apps/mfe-chat/src/features/streaming-perf/** |
| bundle-full-ci | bundle-size | scheduled full size run, 0 over-limit of 20 | nx+size-limit | .github/workflows/size-full.yml |
| bundle-shared-wired | bundle-size | shared deps load once: react/react-dom/router/query copies =1 | vitest | scripts/ci/shared-deps.ts |
| sec-jwt-secret | security | 0 services with JWT_SECRET default; forged JWT rejected 401 | vitest | services/conversation-service/src/shared/** |
| sec-headers | security | CSP, HSTS, X-Frame-Options, nosniff present in Caddyfile (0 missing) | vitest | deploy/azure/Caddyfile |
| sec-ratelimit | security | auth: 429 after N bad logins per IP; 0 unauthenticated /metrics | vitest+supertest | services/auth-service/src/integration/rate-limit.spec.ts |
| sec-authz-idor | security | 0 cross-user reads: tampered/expired/alg=none JWT 401, IDOR 403/404 | vitest | services/conversation-service/src/integration/authz.spec.ts |
| sec-upload | security | spoofed MIME rejected 415; >20MB rejected 413 | vitest | services/conversation-service/src/features/files/** |
| sec-sca | security | 0 high/critical CVEs (pnpm audit) | pnpm audit | .github/workflows/sca.yml |
| a11y-vitest-axe | accessibility | 0 serious/critical axe violations per component state | vitest-axe | apps/mfe-chat/src/**/*.a11y.test.tsx |
| a11y-lh | accessibility | Lighthouse accessibility score >=0.95 on 5 pages | lighthouse-ci | testing/lighthouse/a11y/** |
| a11y-keyboard | accessibility | focus returns to trigger after dialog close; live region role=status once | vitest+testing-library | apps/mfe-settings/src/**/*.a11y.test.tsx |
| res-health-db | resilience | /health returns 503 when DB down | vitest | services/auth-service/src/features/health/** |
| res-stop-abort | resilience | Stop aborts upstream request within 1s | vitest+mock-server | services/conversation-service/src/integration/stop-abort.spec.ts |
| res-sse-reconnect | resilience | after drop, resync <5s, 0 dup/lost messages | vitest | apps/mfe-chat/src/shared/sse-reconnect.test.ts |
| res-chaos | resilience | Postgres down 30s: recovery <60s, 0 crashes | docker script | scripts/chaos/** |
| priv-caddy-logs | privacy | 0 query strings/client IPs in Caddy access log format | vitest | deploy/Caddyfile |
| priv-internal-erasure | privacy | /api/internal/erasures via proxy -> 403/404 | vitest | services/conversation-service/src/integration/internal-route.spec.ts |
| obs-config | observability | promtool/loki verify-config exit 0 | promtool | observability/** |
| obs-dashboards | observability | 3 remaining dashboards valid JSON schema, 0 missing panels | vitest | packages/observability/src/dashboards/** |
| cov-guard-floor | coverage | no project threshold < approved (80/75) | vitest | packages/workspace-config/src/coverage-guard.ts |
| cov-weekly | coverage | weekly full nx run-many -t test, 0 failures | GH Actions | .github/workflows/weekly.yml |
