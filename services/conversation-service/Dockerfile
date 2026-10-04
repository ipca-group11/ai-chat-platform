# conversation-service — multi-stage build assuming a pnpm workspace root (platform pod)
# with this service at services/conversation-service. Build context is the repo root:
#   docker build -f services/conversation-service/Dockerfile .
#
# On boot the CMD applies the committed migrations (prisma/migrations) with
# `prisma migrate deploy` (scripts/db/prisma-migrate.sh, AICHAT-250), then starts the service.

FROM node:24-alpine AS base
WORKDIR /workspace
# Prisma's query engine dynamically links libssl; Alpine (musl) ships neither by
# default, so `prisma generate`/`prisma migrate deploy` fail at runtime without it.
RUN apk add --no-cache openssl
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
COPY --chmod=755 scripts/db/prisma-migrate.sh /usr/local/bin/prisma-migrate

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace \
  && mkdir -p /data/uploads && chown -R app:app /data/uploads
USER app

WORKDIR /workspace/services/conversation-service
EXPOSE 4002
# Applies pending migrations (creating the `?schema=` schema if needed; a database set up
# earlier with `db push` is baselined first), then replaces the shell with the service.
CMD ["prisma-migrate", "node", "dist/server.js"]
