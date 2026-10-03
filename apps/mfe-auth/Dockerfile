# mfe-auth — Module Federation remote. Multi-stage build assuming a pnpm workspace root,
# with this app at apps/mfe-auth. Build context is the repo root:
#   docker build -f apps/mfe-auth/Dockerfile .
#
# VITE_AUTH_SERVICE_URL is read at *build* time (apps/mfe-auth/src/shared/api-client.ts,
# via import.meta.env) and baked into the bundle. It defaults to empty (same-origin
# `/auth/...`, proxied by the shell) so the session cookies are set on the host the
# browser actually uses. See compose.yaml / docs/DEPLOY.md.

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/mfe-auth/package.json ./apps/mfe-auth/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG VITE_AUTH_SERVICE_URL=
ENV VITE_AUTH_SERVICE_URL=${VITE_AUTH_SERVICE_URL}
RUN pnpm --filter @app/ui run build
RUN pnpm --filter mfe-auth run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/mfe-auth/node_modules ./apps/mfe-auth/node_modules
COPY --from=build /workspace/apps/mfe-auth/dist ./apps/mfe-auth/dist
COPY --from=build /workspace/apps/mfe-auth/package.json ./apps/mfe-auth/package.json
COPY --from=build /workspace/apps/mfe-auth/vite.config.ts ./apps/mfe-auth/vite.config.ts

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /workspace
USER app

WORKDIR /workspace/apps/mfe-auth
EXPOSE 3001
# Invoke the locally installed vite binary directly rather than `pnpm exec`: the runtime
# stage doesn't copy the root package.json/pnpm-workspace.yaml (only node_modules), so
# `pnpm exec` here has no workspace/packageManager context to resolve against and fails
# at container start with a workspace-resolution error.
CMD ["node_modules/.bin/vite", "preview", "--port", "3001", "--host", "0.0.0.0"]
