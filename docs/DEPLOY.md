# Deploy (local Docker)

This is a browser-rendered microfrontend app (Module Federation) with two backend APIs,
Postgres, and Prometheus/Grafana. There is no local LLM: replies come from a hosted
provider (Anthropic, or OpenAI) using the API key each user enters in Settings. `compose.yaml` at the repo root builds and runs
all of it. It is the only local compose file: the older `docker-compose.yml` (Postgres and
Grafana published on every interface, Grafana's default `admin` password, `:latest` images)
was removed in AICHAT-231.

## Run it

```sh
cp .env.example .env   # optional, all vars have safe local defaults
docker compose -f compose.yaml up --build
```

Open **http://127.0.0.1:8000/** (or `http://127.0.0.1:${APP_PORT}/` if you set `APP_PORT`)
once `shell` reports healthy. From there:
- Register/log in (`mfe-auth`, served on its own port, see below).
- Open Settings (`mfe-settings`) and enter your Anthropic API key — keys are stored in
  the browser only and sent per request; nothing answers until a key is set.
- Create chats and send messages (`mfe-chat`), streamed via SSE from
  `conversation-service`, answered by the chat's Anthropic model (new chats default to
  `claude-haiku-4-5`).

Prometheus is at `http://127.0.0.1:9090/`, Grafana at `http://127.0.0.1:3300/`
(login `admin`/`admin` by default) with a Prometheus datasource and a
"Platform overview" dashboard pre-provisioned.

## Why more than one published port

`.factory/deploy.json` names `shell` as the entry service, and it is the only service
published in the required `127.0.0.1:${APP_PORT:-8000}:<container port>` form. However,
this app's Module Federation remotes (`mfe-auth`, `mfe-chat`, `mfe-settings`) and both
backend APIs (`auth-service`, `conversation-service`) are called **directly by the
browser** (their URLs are baked into the built JS at image-build time — see each
Dockerfile's `ARG VITE_*` and `apps/shell/module-federation.config.ts`/
`*/src/**/api-client.ts`), not proxied through `shell`. Each of those five services
therefore also publishes its own fixed `127.0.0.1` port so the browser can reach it. The
only exception is `mfe-chat`, whose API client defaults to a same-origin `/api` path;
`shell`'s preview server proxies `/api/*` to `conversation-service` for it (see
`apps/shell/vite.config.ts`). `postgres` is internal-only and is never
published to the host.

| Service | Host port (default) | Purpose |
|---|---|---|
| `shell` | `127.0.0.1:8000` (`APP_PORT`) | **Entry point** — open this in a browser |
| `mfe-auth` | `127.0.0.1:3001` | Module Federation remote (login/register) |
| `mfe-chat` | `127.0.0.1:3002` | Module Federation remote (chat UI) |
| `mfe-settings` | `127.0.0.1:3003` | Module Federation remote (API key settings) |
| `auth-service` | `127.0.0.1:4001` | Auth REST API, called directly by the browser |
| `conversation-service` | `127.0.0.1:4002` | Chat REST/SSE API, called directly by the browser and via `shell`'s `/api` proxy |
| `prometheus` | `127.0.0.1:9090` | Metrics |
| `grafana` | `127.0.0.1:3300` | Dashboards |
| `postgres` | *(not published)* | Internal only, reached over the compose network |

If you change a `*_PORT` variable, the matching service's build-time remote/API URL is
derived from the same variable (see `compose.yaml`'s `build.args`), so the two always
stay in sync — no need to edit anything else.

## Configuration

All configuration is environment variables; see `.env.example` for the full list and
defaults (Postgres credentials, `JWT_SECRET`, token TTLs, ports, Grafana
admin credentials). Copy it to `.env` and edit before `docker compose up` to override
anything; every variable already has a safe local-only default so this step is optional.
LLM provider API keys (OpenAI/Anthropic) are **not** configured here — they're entered
per-user in the Settings page and sent per-request from the browser (never stored
server-side).

Cookies are issued with `Secure=false` in this local HTTP deployment (`COOKIE_SECURE` env
on `auth-service`) since there's no TLS termination in front of `shell`; set it to `true`
and put a TLS-terminating proxy in front of every published port for anything beyond
local use.

## Known gaps (local Docker deploy, not a devops issue)

- **Database schema (resolved in AICHAT-250).** Each service has committed migrations in
  `services/*/prisma/migrations`. On boot the container runs `scripts/db/prisma-migrate.sh`,
  which applies them with `prisma migrate deploy` (it also creates the `?schema=` schema of
  `DATABASE_URL`) and then starts the server. A database set up before, with `prisma db push`,
  has no migration history: the script marks the first (baseline) migration as applied and
  continues, so existing data is kept. A schema change now needs a migration
  (`pnpm exec prisma migrate dev --name <change>` in the service); the `test-db` target fails
  when `schema.prisma` and the migrations differ.
- `mfe-chat`'s SSE stream is proxied through `shell`'s `vite preview` dev-ish server
  (`/api` -> `conversation-service`), which is adequate for local use but not a
  production-grade reverse proxy.

## Stop it

```sh
docker compose -f compose.yaml down          # stop and remove containers
docker compose -f compose.yaml down -v       # also remove volumes (Postgres data,
                                              # uploaded files, Grafana data)
```
