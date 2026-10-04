# conversation-service — multi-stage build assuming a pnpm workspace root (platform pod)
# with this service at services/conversation-service. Build context is the repo root:
#   docker build -f services/conversation-service/Dockerfile .
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
COPY services/conversation-service/package.json ./services/conversation-service/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# The service imports the model capability rules from packages/shared-types, as compiled JS.
RUN pnpm --filter @app/shared-types run build
RUN pnpm --filter @app/conversation-service run prisma:generate
RUN pnpm --filter @app/conversation-service run build
# `prisma generate` emits a plain-JS client into src/generated/prisma-client (see
# prisma/schema.prisma); tsc (no `allowJs`) does not copy it into dist, but
# src/shared/prisma.ts imports it at runtime via a relative "../generated/..." path, so it
# must land at dist/generated/prisma-client for `node dist/server.js` to resolve it.
RUN cp -r services/conversation-service/src/generated services/conversation-service/dist/generated

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/services/conversation-service/node_modules ./services/conversation-service/node_modules
COPY --from=build /workspace/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /workspace/services/conversation-service/dist ./services/conversation-service/dist
COPY --from=build /workspace/services/conversation-service/prisma ./services/conversation-service/prisma
COPY --from=build /workspace/services/conversation-service/package.json ./services/conversation-service/package.json

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace \
  && mkdir -p /data/uploads && chown -R app:app /data/uploads
USER app

WORKDIR /workspace/services/conversation-service
EXPOSE 4002
# Postgres never auto-creates the schema named in DATABASE_URL's `?schema=` param, so
# create it (if missing) before `prisma db push`, which otherwise fails against a fresh
# database. Connecting with a not-yet-existing schema in the search_path is harmless.
# psql (unlike Prisma) rejects the `schema` query parameter as an unknown URI option, so
# it must be stripped from the URL passed to psql; the un-stripped DATABASE_URL is still
# used for `prisma db push`/the app itself.
CMD ["sh", "-c", "schema=$(printf '%s' \"$DATABASE_URL\" | sed -n 's/.*[?&]schema=\\([^&]*\\).*/\\1/p'); psql_url=$(printf '%s' \"$DATABASE_URL\" | sed -e 's/[?&]schema=[^&]*$//' -e 's/\\([?&]\\)schema=[^&]*&/\\1/'); if [ -n \"$schema\" ]; then psql \"$psql_url\" -v ON_ERROR_STOP=1 -c \"CREATE SCHEMA IF NOT EXISTS \\\"$schema\\\"\"; fi && npx prisma db push --skip-generate --accept-data-loss --schema=./prisma/schema.prisma && node dist/server.js"]
