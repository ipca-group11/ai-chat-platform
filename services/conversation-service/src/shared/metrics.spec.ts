import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { captureRouteTemplate, createMetrics } from "./metrics.js";

async function scrape(metricsHandler: ReturnType<typeof createMetrics>["metricsHandler"]): Promise<string> {
  const send = vi.fn();
  await metricsHandler({} as Request, { setHeader: vi.fn(), send } as unknown as Response);
  return send.mock.calls[0]?.[0] as string;
}

/** A real Express app with a mounted router, so labels come from Express's own routing. */
function buildApp() {
  const metrics = createMetrics();
  const app = express();
  app.use(metrics.metricsMiddleware);
  app.get("/metrics", metrics.metricsHandler);
  const chats = express.Router();
  chats.get("/:chatId", (_req, res) => {
    res.json({ ok: true });
  });
  chats.get("/:chatId/missing", (_req, _res, next) => {
    next(Object.assign(new Error("not found"), { status: 404 }));
  });
  app.use("/chats", chats);
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message });
  });
  return { app, ...metrics };
}

describe("createMetrics", () => {
  it("AC-45: records request duration and exposes it via the /metrics handler", async () => {
    const { app } = buildApp();

    await request(app).get("/chats/abc");
    const res = await request(app).get("/metrics");

    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain('http_request_duration_seconds_bucket{le="0.005",method="GET",route="/chats/:chatId",status="200"}');
  });

  it("counts requests in http_requests_total labelled by route template, not the raw URL", async () => {
    const { app, metricsHandler } = buildApp();

    await request(app).get("/chats/abc");
    await request(app).get("/chats/def");

    expect(await scrape(metricsHandler)).toContain('http_requests_total{method="GET",route="/chats/:chatId",status="200"} 2');
  });

  it("keeps the router mount in the label when the handler fails via next(err)", async () => {
    const { app, metricsHandler } = buildApp();

    await request(app).get("/chats/abc/missing");

    expect(await scrape(metricsHandler)).toContain(
      'http_requests_total{method="GET",route="/chats/:chatId/missing",status="404"} 1',
    );
  });

  it('labels requests no route matched as "unmatched"', async () => {
    const { app, metricsHandler } = buildApp();

    await request(app).get("/nope/123");

    expect(await scrape(metricsHandler)).toContain('http_requests_total{method="GET",route="unmatched",status="404"} 1');
  });

  it("exposes active_streams, which follows inc/dec", async () => {
    const { metricsHandler, activeStreams } = createMetrics();

    activeStreams.inc();
    activeStreams.inc();
    activeStreams.dec();

    expect(await scrape(metricsHandler)).toContain("active_streams 1");
  });
});

describe("captureRouteTemplate", () => {
  it("snapshots baseUrl at the moment the route is assigned", () => {
    const req = { baseUrl: "/chats" } as Request;
    const template = captureRouteTemplate(req);

    (req as { route: unknown }).route = { path: "/:chatId" };
    req.baseUrl = "";

    expect(template()).toBe("/chats/:chatId");
    expect(req.route).toEqual({ path: "/:chatId" });
  });
});
