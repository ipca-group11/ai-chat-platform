/**
 * `auth-service` HTTP entrypoint (PLAN.md B1). Bootstraps Express with the
 * cross-cutting concerns every route needs: security headers (`helmet`), CORS with
 * credentials (so browser `fetch(..., { credentials: 'include' })` calls work),
 * rate limiting, JSON body parsing, cookie parsing, correlation-id propagation,
 * structured/redacted logging, `/metrics` (Prometheus) and `/health`.
 */
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { collectDefaultMetrics, register as metricsRegister } from "prom-client";
import type { PrismaClient } from "./generated/prisma-client/index.js";
import { createAccountRouter } from "./features/account/index.js";
import { runRetention, scheduleRetention } from "./features/retention/index.js";
import { createRegisterRouter } from "./features/register/index.js";
import { createSessionRouter } from "./features/session/index.js";
import { createErasureClient, type ErasureClient } from "./shared/erasure-client.js";
import { correlationIdMiddleware } from "./shared/correlation-id.js";
import { env } from "./shared/env.js";
import { errorMiddleware, notFoundMiddleware } from "./shared/error-middleware.js";
import { httpMetricsMiddleware } from "./shared/http-metrics.js";
import { serializeError } from "./shared/pii-scrub.js";
import { logger as defaultLogger, serializeRequest, serializeResponse, type Logger } from "./shared/logger.js";
import { prisma as defaultPrisma } from "./shared/prisma.js";

collectDefaultMetrics({ register: metricsRegister, prefix: "auth_service_" });

/** Optional replacements for what `createApp` wires itself (testability seam, plan
 * decision D3). Without them the app uses the real Prisma client, as before. */
export interface AppDeps {
  prisma?: PrismaClient;
  /** Where request and error logs go; tests pass one that writes to memory. */
  logger?: Logger;
  /** Calls conversation-service to erase a user's data; tests pass a fake. Defaults to the
   * real client when INTERNAL_SERVICE_TOKEN and CONVERSATION_SERVICE_URL are set. */
  erasure?: ErasureClient;
  /** Account deletions per client and hour (default 10). */
  deletionsPerHour?: number;
  /** Requests per client address and 15 minutes (default 300). */
  requestsPerWindow?: number;
  /** Express `trust proxy` (default TRUST_PROXY, 1 hop: Caddy). */
  trustProxy?: number | string;
}

function defaultErasureClient(): ErasureClient | undefined {
  if (!env.INTERNAL_SERVICE_TOKEN || !env.CONVERSATION_SERVICE_URL) return undefined;
  return createErasureClient({ baseUrl: env.CONVERSATION_SERVICE_URL, token: env.INTERNAL_SERVICE_TOKEN });
}

export function createApp(deps: AppDeps = {}): Express {
  const prisma = deps.prisma ?? defaultPrisma;
  const logger = deps.logger ?? defaultLogger;
  const app = express();

  app.disable("x-powered-by");
  // Behind Caddy every request comes from the proxy's address. Trusting the hops in front of the service
  // makes req.ip the real client (the address the last trusted proxy saw), so the limiter below counts
  // each client on its own instead of everyone together (AICHAT-222).
  app.set("trust proxy", deps.trustProxy ?? env.TRUST_PROXY);
  app.use(helmet());
  app.use(httpMetricsMiddleware);
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: deps.requestsPerWindow ?? 300,
      standardHeaders: true,
      legacyHeaders: false,
      // Keyed on the client address resolved through `trust proxy` (IPv6 grouped by /56).
      keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
    }),
  );
  app.use(correlationIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      serializers: { req: serializeRequest, res: serializeResponse, err: serializeError },
      genReqId: (req: Request) => req.correlationId,
      customProps: (req: Request) => ({ correlationId: req.correlationId }),
    }),
  );
  // Body parsing after the correlation id and request log, so a malformed body still gets both and the
  // error middleware answers 400 with the request's id (AICHAT-217).
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", metricsRegister.contentType);
    res.send(await metricsRegister.metrics());
  });

  app.use("/auth", createRegisterRouter(prisma));
  app.use("/auth", createSessionRouter(prisma));
  app.use("/auth", createAccountRouter(prisma, { erasure: deps.erasure ?? defaultErasureClient(), deletionsPerHour: deps.deletionsPerHour }));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

/* c8 ignore start -- process bootstrap, not exercised by unit tests */
if (process.env.VITEST === undefined) {
  const app = createApp();
  app.listen(env.PORT, () => {
    defaultLogger.info({ port: env.PORT }, "auth-service listening");
  });
  if (env.RETENTION_INTERVAL_MINUTES > 0) {
    scheduleRetention(
      async () => {
        const result = await runRetention(new Date(), {
          prisma: defaultPrisma,
          erasure: defaultErasureClient(),
          onAccountError: (_userId, err) => defaultLogger.warn({ err }, "inactive account not deleted, will retry"),
        });
        defaultLogger.info(result, "retention run finished");
      },
      env.RETENTION_INTERVAL_MINUTES * 60 * 1000,
      (err) => defaultLogger.error({ err }, "retention run failed"),
    );
  }
}
/* c8 ignore stop */
