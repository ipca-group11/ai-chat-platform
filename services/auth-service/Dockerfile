# auth-service — multi-stage build assuming a pnpm workspace root with this service at
# services/auth-service. Build context is the repo root:
#   docker build -f services/auth-service/Dockerfile .
#
# No Prisma migration history exists yet for this schema (see prisma/schema.prisma), so
# the runtime CMD applies the schema with `prisma db push` on boot instead of
# `prisma migrate deploy`. This is a pragmatic choice for local Docker deployment; a real
# environment should replace it with committed migrations + `migrate deploy`.

FROM node:24-alpine AS base
WORKDIR /workspace
# Prisma's query engine dynamically links libssl; Alpine (musl) ships neither by
# default, so `prisma generate`/`prisma db push` fail at runtime without it.
# `postgresql-client` (psql) is used by the runtime CMD to create this service's Postgres
# schema (DATABASE_URL's `?schema=` param) before `prisma db push`, since Prisma does not
# create that schema itself and `db push` fails on a fresh database otherwise.
RUN apk add --no-cache openssl postgresql-client
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY services/auth-service/package.json ./services/auth-service/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @app/auth-service run prisma:generate
RUN pnpm --filter @app/auth-service run build
# `prisma generate` emits a plain-JS client into src/generated/prisma-client (see
# prisma/schema.prisma); tsc (no `allowJs`) does not copy it into dist, but
# src/shared/prisma.ts imports it at runtime via a relative "../generated/..." path, so it
# must land at dist/generated/prisma-client for `node dist/main.js` to resolve it.
RUN cp -r services/auth-service/src/generated services/auth-service/dist/generated

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/services/auth-service/node_modules ./services/auth-service/node_modules
COPY --from=build /workspace/services/auth-service/dist ./services/auth-service/dist
COPY --from=build /workspace/services/auth-service/prisma ./services/auth-service/prisma
COPY --from=build /workspace/services/auth-service/package.json ./services/auth-service/package.json

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace
USER app

WORKDIR /workspace/services/auth-service
EXPOSE 4001
# Postgres never auto-creates the schema named in DATABASE_URL's `?schema=` param, so
# create it (if missing) before `prisma db push`, which otherwise fails against a fresh
# database. Connecting with a not-yet-existing schema in the search_path is harmless.
# psql (unlike Prisma) rejects the `schema` query parameter as an unknown URI option, so
# it must be stripped from the URL passed to psql; the un-stripped DATABASE_URL is still
# used for `prisma db push`/the app itself.
CMD ["sh", "-c", "schema=$(printf '%s' \"$DATABASE_URL\" | sed -n 's/.*[?&]schema=\\([^&]*\\).*/\\1/p'); psql_url=$(printf '%s' \"$DATABASE_URL\" | sed -e 's/[?&]schema=[^&]*$//' -e 's/\\([?&]\\)schema=[^&]*&/\\1/'); if [ -n \"$schema\" ]; then psql \"$psql_url\" -v ON_ERROR_STOP=1 -c \"CREATE SCHEMA IF NOT EXISTS \\\"$schema\\\"\"; fi && npx prisma db push --skip-generate --accept-data-loss --schema=./prisma/schema.prisma && node dist/main.js"]
