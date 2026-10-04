import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

const faroPayload = {
  meta: { app: { name: "shell" }, sdk: { name: "@grafana/faro-web-sdk" } },
  logs: [{ message: "hello", level: "info" }],
};

describe("collect mock (Faro sink)", () => {
  it("POST /collect accepts a payload and GET /__admin/requests?mock=collect returns it", async () => {
    const { app } = createApp(loadConfig({}));

    const res = await request(app).post("/collect").send(faroPayload);
    expect(res.status).toBe(202);

    const stored = await request(app).get("/__admin/requests?mock=collect");
    expect(stored.body.count).toBe(1);
    expect(stored.body.requests[0]).toMatchObject({ mock: "collect", method: "POST", path: "/collect", body: faroPayload, status: 202 });
  });

  it("keeps payloads in arrival order and /__admin/reset empties them", async () => {
    const { app } = createApp(loadConfig({}));
    await request(app).post("/collect").send({ n: 1 });
    await request(app).post("/collect").send({ n: 2 });
    const before = await request(app).get("/__admin/requests?mock=collect");
    expect(before.body.requests.map((r: { body: { n: number } }) => r.body.n)).toEqual([1, 2]);

    await request(app).post("/__admin/reset");

    expect((await request(app).get("/__admin/requests?mock=collect")).body.count).toBe(0);
  });

  it("answers the CORS preflight of the browser SDK", async () => {
    const { app } = createApp(loadConfig({}));
    const res = await request(app).options("/collect").set("Origin", "http://localhost:5173");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
