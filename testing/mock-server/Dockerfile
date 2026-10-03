# mock-server: multi-stage build assuming a pnpm workspace root with this project at
# testing/mock-server. Build context is the repo root:
#   docker build -f testing/mock-server/Dockerfile -t ai-chat-mock-server .

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY testing/mock-server/package.json ./testing/mock-server/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY testing/mock-server ./testing/mock-server
RUN pnpm --filter @platform/mock-server run build

# The bundle contains every dependency, so the runtime image needs Node only.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/testing/mock-server/dist/main.cjs ./main.cjs

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENV PORT=4010
EXPOSE 4010
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/__admin/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "main.cjs"]
