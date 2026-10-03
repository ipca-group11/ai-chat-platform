import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { BROKEN_REMOTE_ENTRY, OK_REMOTE_ENTRY } from "./remotes.router.js";

const app = () => createApp(loadConfig({})).app;

describe("remotes mock", () => {
  it("ok serves a Module Federation style container as JavaScript", async () => {
    const res = await request(app()).get("/remotes/ok/remoteEntry.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/javascript");
    expect(res.text).toBe(OK_REMOTE_ENTRY);
    expect(res.text).toContain("export async function get");
  });

  it("slow waits for ?delayMs= before answering like ok", async () => {
    const t0 = Date.now();
    const res = await request(app()).get("/remotes/slow/remoteEntry.js?delayMs=120");
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
    expect(res.status).toBe(200);
    expect(res.text).toBe(OK_REMOTE_ENTRY);
  });

  it("slow ignores a negative or invalid delay and uses the default", async () => {
    const { app: a } = createApp(loadConfig({}));
    const pending = request(a).get("/remotes/slow/remoteEntry.js?delayMs=-5").timeout({ response: 200 });
    await expect(pending).rejects.toThrow();
  });

  it("404 answers not found", async () => {
    const res = await request(app()).get("/remotes/404/remoteEntry.js");
    expect(res.status).toBe(404);
  });

  it("an unknown remote name also answers 404", async () => {
    expect((await request(app()).get("/remotes/nope/remoteEntry.js")).status).toBe(404);
  });

  it("broken-js answers 200 with JavaScript that does not parse", async () => {
    const res = await request(app()).get("/remotes/broken-js/remoteEntry.js");
    expect(res.status).toBe(200);
    expect(res.text).toBe(BROKEN_REMOTE_ENTRY);
    expect(() => new Function(res.text)).toThrow(SyntaxError);
  });

  it("registers its four scenarios", async () => {
    const res = await request(app()).get("/__admin/scenarios");
    expect(res.body.scenarios.map((s: { name: string }) => s.name)).toEqual(["404", "broken-js", "ok", "slow"]);
  });
});
