import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import type { MockModule } from "../registry.js";
import { createRequestLog, MASK, maskValue } from "./request-log.js";

const echo = (name: string): MockModule => ({
  name,
  mountPath: `/${name}`,
  createRouter: () => {
    const router = Router();
    router.all("/echo", (_req, res) => {
      res.status(201).json({ ok: true });
    });
    return router;
  },
});

const makeApp = () => createApp(loadConfig({}), [echo("alpha"), echo("beta")]).app;

describe("request log", () => {
  it("records requests of every mock and filters by mock", async () => {
    const app = makeApp();
    await request(app).get("/alpha/echo?x=1");
    await request(app).post("/beta/echo").send({ hello: "world" });

    const all = (await request(app).get("/__admin/requests")).body;
    expect(all.count).toBe(2);
    expect(all.requests[0]).toMatchObject({ id: 1, mock: "alpha", method: "GET", path: "/alpha/echo", query: { x: "1" }, status: 201 });
    expect(all.requests[1]).toMatchObject({ mock: "beta", method: "POST", body: { hello: "world" } });

    const beta = (await request(app).get("/__admin/requests?mock=beta")).body;
    expect(beta.requests.map((r: { mock: string }) => r.mock)).toEqual(["beta"]);
  });

  it("does not log the admin endpoints", async () => {
    const app = makeApp();
    await request(app).get("/__admin/health");
    expect((await request(app).get("/__admin/requests")).body.count).toBe(0);
  });

  it("masks API keys, tokens and cookies in headers", async () => {
    const app = makeApp();
    await request(app)
      .get("/alpha/echo")
      .set("Authorization", "Bearer secret-token")
      .set("x-api-key", "sk-ant-123")
      .set("x-llm-api-key", "sk-live-456")
      .set("Cookie", "session=abc")
      .set("User-Agent", "vitest");

    const { headers } = (await request(app).get("/__admin/requests")).body.requests[0];
    for (const name of ["authorization", "x-api-key", "x-llm-api-key", "cookie"]) expect(headers[name]).toBe(MASK);
    expect(headers["user-agent"]).toBe("vitest");
  });

  it("masks body and query fields named like key, token or password at any depth", async () => {
    const app = makeApp();
    await request(app)
      .post("/alpha/echo?token=t1&page=2")
      .send({ email: "a@b.pt", password: "hunter2", nested: { apiKey: "k", list: [{ accessToken: "x", name: "n" }] } });

    const entry = (await request(app).get("/__admin/requests")).body.requests[0];
    expect(entry.query).toEqual({ token: MASK, page: "2" });
    expect(entry.body).toEqual({ email: "a@b.pt", password: MASK, nested: { apiKey: MASK, list: [{ accessToken: MASK, name: "n" }] } });
    expect(JSON.stringify(entry)).not.toMatch(/hunter2|secret-token|"k"/);
  });

  it("is cleared by /__admin/reset", async () => {
    const app = makeApp();
    await request(app).get("/alpha/echo");
    await request(app).post("/__admin/reset");
    expect((await request(app).get("/__admin/requests")).body).toEqual({ count: 0, requests: [] });
  });

  it("logs a body that is not valid JSON without a body and leaves the answer to the router", async () => {
    const app = makeApp();
    await request(app).post("/alpha/echo").set("Content-Type", "application/json").send("{nope");
    const entry = (await request(app).get("/__admin/requests")).body.requests[0];
    expect(entry.path).toBe("/alpha/echo");
    expect(entry.body).toBeUndefined();
  });

  it("keeps only the newest entries when the capacity is reached", async () => {
    const direct = createRequestLog(2);
    const fake = (n: number) => {
      const handler = direct.middleware("m");
      return new Promise<void>((resolve) => {
        handler(
          { method: "GET", originalUrl: `/m/${n}`, headers: {}, query: {}, body: undefined, on: () => undefined } as never,
          { on: () => undefined, statusCode: 200 } as never,
          () => resolve(),
        );
      });
    };
    await fake(1);
    await fake(2);
    await fake(3);
    expect(direct.list().map((e) => e.path)).toEqual(["/m/2", "/m/3"]);
    direct.clear();
    expect(direct.list()).toEqual([]);
  });

  it("maskValue leaves primitives alone", () => {
    expect(maskValue(5)).toBe(5);
    expect(maskValue(null)).toBeNull();
  });
});
