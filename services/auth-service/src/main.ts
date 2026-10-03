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
import { registerRouter } from "./features/register/index.js";
import { sessionRouter } from "./features/session/index.js";
import { correlationIdMiddleware } from "./shared/correlation-id.js";
import { env } from "./shared/env.js";
import { errorMiddleware, notFoundMiddleware } from "./shared/error-middleware.js";
import { httpMetricsMiddleware } from "./shared/http-metrics.js";
import { logger } from "./shared/logger.js";

collectDefaultMetrics({ register: metricsRegister, prefix: "auth_service_" });

export function createApp(): Express {
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

  app.use("/auth", registerRouter);
  app.use("/auth", sessionRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

/* c8 ignore start -- process bootstrap, not exercised by unit tests */
if (process.env.VITEST === undefined) {
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "auth-service listening");
  });
}
/* c8 ignore stop */
