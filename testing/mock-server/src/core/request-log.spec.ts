import { get } from "node:http";
import type { AddressInfo } from "node:net";
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

/** A mock that streams `chunks` pieces, one every 10 ms, like a slow LLM answer. */
const slowStream = (chunks: number): MockModule => ({
  name: "slow",
  mountPath: "/slow",
  createRouter: () => {
    const router = Router();
    router.get("/stream", (req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      let sent = 0;
      const timer = setInterval(() => {
        res.write(`data: ${sent}\n\n`);
        if (++sent === chunks) {
          clearInterval(timer);
          res.end();
        }
      }, 10);
      req.on("close", () => clearInterval(timer));
    });
    return router;
  },
});

/** Reads `/slow/stream`; with `leaveAfterFirstChunk` the client disconnects as soon as data arrives. */
async function readStream(port: number, leaveAfterFirstChunk: boolean): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = get({ port, path: "/slow/stream" }, (res) => {
      res.on("data", () => {
        if (leaveAfterFirstChunk) req.destroy();
      });
      res.on("end", resolve);
      res.on("close", resolve);
    });
    req.on("error", () => resolve());
  });
}

async function waitFor<T>(read: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const value = await read();
    if (ok(value)) return value;
    await new Promise((r) => setTimeout(r, 10));
  }
  return read();
}

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

  // AICHAT-201: a stopped stream shows up as a client that left before the answer was complete.
  describe("finished vs closed by the client (AICHAT-201)", () => {
    async function withServer(run: (port: number, app: ReturnType<typeof createApp>["app"]) => Promise<void>) {
      const { app } = createApp(loadConfig({}), [slowStream(50)]);
      const server = app.listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      try {
        await run((server.address() as AddressInfo).port, app);
      } finally {
        server.closeAllConnections();
        server.close();
      }
    }
    const lastEntry = async (app: ReturnType<typeof createApp>["app"]) =>
      (await request(app).get("/__admin/requests?mock=slow")).body.requests.at(-1) as {
        status: number | null;
        finishedAt: string | null;
        clientClosedAt: string | null;
      };

    it("an answer read to the end has finishedAt and no clientClosedAt (control case)", async () => {
      await withServer(async (port, app) => {
        await readStream(port, false);
        const entry = await waitFor(() => lastEntry(app), (e) => e.finishedAt !== null);
        expect(entry).toMatchObject({ status: 200, clientClosedAt: null });
        expect(entry.finishedAt).not.toBeNull();
      });
    });

    it("a client that leaves mid-answer is logged with clientClosedAt and no finishedAt", async () => {
      await withServer(async (port, app) => {
        const left = Date.now();
        await readStream(port, true);
        const entry = await waitFor(() => lastEntry(app), (e) => e.clientClosedAt !== null);
        expect(entry.finishedAt).toBeNull();
        expect(entry.clientClosedAt).not.toBeNull();
        // Logged when the client left, well before the 500 ms the whole answer would take.
        expect(Date.parse(entry.clientClosedAt as string) - left).toBeLessThan(400);
      });
    });
  });

  it("maskValue leaves primitives alone", () => {
    expect(maskValue(5)).toBe(5);
    expect(maskValue(null)).toBeNull();
  });
});
