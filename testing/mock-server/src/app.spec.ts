import { Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { mockModules } from "./routers/index.js";
import type { MockModule } from "./registry.js";

const config = (env: NodeJS.ProcessEnv = {}) => loadConfig(env);

describe("admin endpoints", () => {
  it("GET /__admin/health answers ok", async () => {
    const { app } = createApp(config());
    const res = await request(app).get("/__admin/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /__admin/scenarios lists the scenarios the mocks registered", async () => {
    const module: MockModule = {
      name: "demo",
      mountPath: "/demo",
      scenarios: [{ mock: "demo", name: "ok", description: "Normal answer" }],
      createRouter: () => Router(),
    };
    const { app } = createApp(config(), [module]);
    const res = await request(app).get("/__admin/scenarios");
    expect(res.body).toEqual({ scenarios: [{ mock: "demo", name: "ok", description: "Normal answer" }] });
  });

  it("GET /__admin/scenarios is empty while no mock registers a scenario", async () => {
    const { app } = createApp(config(), []);
    const res = await request(app).get("/__admin/scenarios");
    expect(res.body).toEqual({ scenarios: [] });
  });

  it("POST /__admin/reset restarts the random sequence and runs the reset hooks of the mocks", async () => {
    const hook = vi.fn();
    const module: MockModule = {
      name: "demo",
      mountPath: "/demo",
      createRouter: (ctx) => {
        ctx.onReset(hook);
        return Router();
      },
    };
    const { app, ctx } = createApp(config({ SEED: "11" }), [module]);
    const first = ctx.rng.next();
    ctx.rng.next();

    const res = await request(app).post("/__admin/reset");

    expect(res.body).toEqual({ status: "reset" });
    expect(hook).toHaveBeenCalledTimes(1);
    expect(ctx.rng.next()).toBe(first);
  });
});

describe("mock routers", () => {
  it("mounts one router per mock", () => {
    expect(mockModules.map((m) => m.name)).toEqual([
      "anthropic",
      "openai",
      "auth",
      "conversation",
      "remotes",
      "collect",
    ]);
    expect(new Set(mockModules.map((m) => m.mountPath)).size).toBe(mockModules.length);
  });

  it.each(mockModules.map((m) => m.mountPath))("answers 404 JSON for an unmocked route under %s", async (path) => {
    const { app } = createApp(config());
    const res = await request(app).get(`${path}/unknown`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_mocked");
  });

  it("answers 404 JSON outside every mock", async () => {
    const { app } = createApp(config());
    expect((await request(app).get("/nothing")).status).toBe(404);
  });
});

describe("LATENCY_MS and ERROR_RATE", () => {
  const demo: MockModule = {
    name: "demo",
    mountPath: "/demo",
    createRouter: () => {
      const router = Router();
      router.get("/hello", (_req, res) => {
        res.json({ hello: "world" });
      });
      return router;
    },
  };

  it("delays mock responses by LATENCY_MS but not the admin endpoints", async () => {
    const { app } = createApp(config({ LATENCY_MS: "80" }), [demo]);
    const t0 = Date.now();
    await request(app).get("/__admin/health");
    const adminMs = Date.now() - t0;
    const t1 = Date.now();
    await request(app).get("/demo/hello");
    const mockMs = Date.now() - t1;
    expect(mockMs).toBeGreaterThanOrEqual(75);
    expect(adminMs).toBeLessThan(75);
  });

  it("ERROR_RATE=1 fails every mock request with a 500 and spares the admin endpoints", async () => {
    const { app } = createApp(config({ ERROR_RATE: "1" }), [demo]);
    const res = await request(app).get("/demo/hello");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("mock_random_error");
    expect((await request(app).get("/__admin/health")).status).toBe(200);
  });

  it("ERROR_RATE=0 never fails", async () => {
    const { app } = createApp(config(), [demo]);
    for (let i = 0; i < 10; i++) expect((await request(app).get("/demo/hello")).status).toBe(200);
  });

  it("the same SEED fails the same requests", async () => {
    const run = async () => {
      const { app } = createApp(config({ ERROR_RATE: "0.5", SEED: "77" }), [demo]);
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) statuses.push((await request(app).get("/demo/hello")).status);
      return statuses;
    };
    const first = await run();
    expect(await run()).toEqual(first);
    expect(new Set(first).size).toBe(2);
  });
});

describe("seed endpoints", () => {
  it("POST /__admin/seed/<dataset> loads the dataset and returns the record counts", async () => {
    const { app, ctx } = createApp(config());
    expect(ctx.store.name).toBe("empty");

    const res = await request(app).post("/__admin/seed/many-chats");

    expect(res.status).toBe(200);
    expect(res.body.dataset).toBe("many-chats");
    expect(res.body.counts.chats).toBeGreaterThan(200);
    expect(ctx.store.data.chats.length).toBe(res.body.counts.chats);
  });

  it("answers 404 and lists the datasets for an unknown name", async () => {
    const { app } = createApp(config());
    const res = await request(app).post("/__admin/seed/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.available).toContain("default");
  });

  it("GET /__admin/data returns the loaded records", async () => {
    const { app } = createApp(config({ MOCK_DATASET: "long-conversation" }));
    const res = await request(app).get("/__admin/data");
    expect(res.body.dataset).toBe("long-conversation");
    expect(res.body.data.messages).toHaveLength(500);
  });

  it("loads MOCK_DATASET at start-up", () => {
    const { ctx } = createApp(config({ MOCK_DATASET: "default" }));
    expect(ctx.store.name).toBe("default");
    expect(ctx.store.data.users.length).toBeGreaterThan(0);
  });

  it("POST /__admin/reset goes back to MOCK_DATASET", async () => {
    const { app, ctx } = createApp(config({ MOCK_DATASET: "default" }));
    await request(app).post("/__admin/seed/empty");
    expect(ctx.store.data.users).toHaveLength(0);
    await request(app).post("/__admin/reset");
    expect(ctx.store.name).toBe("default");
    expect(ctx.store.data.users.length).toBeGreaterThan(0);
  });
});
