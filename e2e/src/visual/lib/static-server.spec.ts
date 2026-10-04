import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentType, resolveFile, startStaticServer, stopServer } from "./static-server.js";

describe("resolveFile", () => {
  it("maps a URL path into the root and drops the query", () => {
    expect(resolveFile("/site", "/assets/app.js?v=1")).toBe("/site/assets/app.js");
    expect(resolveFile("/site", "/")).toBe("/site/");
  });

  it("refuses paths that leave the root or are not valid URL text", () => {
    expect(resolveFile("/site", "/../etc/passwd")).toBeUndefined();
    expect(resolveFile("/site", "/%2e%2e/%2e%2e/etc/passwd")).toBeUndefined();
    expect(resolveFile("/site", "/%E0%A4%A")).toBeUndefined();
    expect(resolveFile("/site", "/../site-other/file")).toBeUndefined();
  });
});

describe("contentType", () => {
  it("knows the build output types and falls back to binary", () => {
    expect(contentType("a/index.html")).toContain("text/html");
    expect(contentType("a/remoteEntry.js")).toContain("text/javascript");
    expect(contentType("a/font.WOFF2")).toBe("font/woff2");
    expect(contentType("a/file.unknown")).toBe("application/octet-stream");
  });
});

describe("startStaticServer", () => {
  let root: string;
  let spa: Server;
  let plain: Server;
  const base = (server: Server): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "static-server-"));
    mkdirSync(join(root, "assets"));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "index.html"), "<h1>home</h1>");
    writeFileSync(join(root, "docs", "index.html"), "<h1>docs</h1>");
    writeFileSync(join(root, "assets", "app.js"), "export {};");
    spa = await startStaticServer({ root, port: 0, spa: true });
    plain = await startStaticServer({ root, port: 0 });
  });

  afterAll(async () => {
    await Promise.all([stopServer(spa), stopServer(plain)]);
    rmSync(root, { recursive: true, force: true });
  });

  it("serves files with their type, no caching and CORS open for the remotes", async () => {
    const response = await fetch(`${base(plain)}/assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("export {};");
  });

  it("serves index.html for a folder", async () => {
    expect(await (await fetch(`${base(plain)}/docs/`)).text()).toBe("<h1>docs</h1>");
  });

  it("answers 404 for unknown files, and for client routes unless spa is on", async () => {
    expect((await fetch(`${base(plain)}/chats/abc`)).status).toBe(404);
    expect((await fetch(`${base(plain)}/missing.js`)).status).toBe(404);
    const route = await fetch(`${base(spa)}/chats/abc`);
    expect(route.status).toBe(200);
    expect(await route.text()).toBe("<h1>home</h1>");
    expect((await fetch(`${base(spa)}/missing.js`)).status).toBe(404);
  });

  it("does not serve files outside the root", async () => {
    const response = await fetch(`${base(plain)}/%2e%2e/%2e%2e/etc/hosts`);
    expect(response.status).toBe(404);
  });

  it("rejects when the port is taken", async () => {
    await expect(startStaticServer({ root, port: (spa.address() as AddressInfo).port })).rejects.toThrow(/EADDRINUSE/);
  });
});
