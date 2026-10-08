import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { createApp } from "../../main.js";
import { createHealthRouter, type HealthDb } from "./index.js";

const up = (): HealthDb => ({ $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]) });
const down = (): HealthDb => ({ $queryRaw: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5432")) });
const hung = (): HealthDb => ({ $queryRaw: vi.fn().mockReturnValue(new Promise(() => undefined)) });

function appWith(db: HealthDb, timeoutMs?: number) {
  return express().use(createHealthRouter(db, { timeoutMs }));
}

describe("health reflects the database (J5)", () => {
  it("returns 200 when Postgres is up", async () => {
    const res = await request(appWith(up())).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "up" });
  });

  it("returns 503 when Postgres is unreachable", async () => {
    const res = await request(appWith(down())).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "unavailable", db: "down" });
  });

  it("returns 503 when Postgres hangs past the timeout", async () => {
    const res = await request(appWith(hung(), 50)).get("/health");
    expect(res.status).toBe(503);
  });

  it("does not leak the connection error to the client", async () => {
    const res = await request(appWith(down())).get("/health");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|5432/);
  });

  it("recovers to 200 once Postgres is back", async () => {
    const db: HealthDb = { $queryRaw: vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue([]) };
    const app = appWith(db);
    expect((await request(app).get("/health")).status).toBe(503);
    expect((await request(app).get("/health")).status).toBe(200);
  });

  it("the real app serves 503 on /health when its Prisma client cannot reach Postgres", async () => {
    const res = await request(createApp({ prisma: down() as unknown as PrismaClient })).get("/health");
    expect(res.status).toBe(503);
  });

  it("the real app serves 200 on /health when its Prisma client reaches Postgres", async () => {
    const res = await request(createApp({ prisma: up() as unknown as PrismaClient })).get("/health");
    expect(res.status).toBe(200);
  });
});
