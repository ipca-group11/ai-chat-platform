import { Router } from "express";

/** The one thing /health needs from the database client. */
export interface HealthDb {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

export const HEALTH_DB_TIMEOUT_MS = 2000;

async function dbReachable(db: HealthDb, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("db health check timed out")), timeoutMs);
  });
  try {
    await Promise.race([db.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /health: 200 when Postgres answers `SELECT 1`, 503 when it errors or hangs. */
export function createHealthRouter(db: HealthDb, options: { timeoutMs?: number } = {}): Router {
  const router = Router();
  router.get("/health", async (_req, res) => {
    const ok = await dbReachable(db, options.timeoutMs ?? HEALTH_DB_TIMEOUT_MS);
    res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable", db: ok ? "up" : "down" });
  });
  return router;
}
