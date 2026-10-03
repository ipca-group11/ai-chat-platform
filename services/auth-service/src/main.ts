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
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { collectDefaultMetrics, register as metricsRegister } from "prom-client";
import type { PrismaClient } from "./generated/prisma-client/index.js";
import { createRegisterRouter } from "./features/register/index.js";
import { createSessionRouter } from "./features/session/index.js";
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
}

export function createApp(deps: AppDeps = {}): Express {
  const prisma = deps.prisma ?? defaultPrisma;
  const logger = deps.logger ?? defaultLogger;
  const app = express();

  app.disable("x-powered-by");
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
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      serializers: { req: serializeRequest, res: serializeResponse, err: serializeError },
      genReqId: (req: Request) => req.correlationId,
      customProps: (req: Request) => ({ correlationId: req.correlationId }),
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", metricsRegister.contentType);
    res.send(await metricsRegister.metrics());
  });

  app.use("/auth", createRegisterRouter(prisma));
  app.use("/auth", createSessionRouter(prisma));

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
}
/* c8 ignore stop */
