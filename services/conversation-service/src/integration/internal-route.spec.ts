/**
 * NFR: the internal erasure route is not public. `/api/internal/erasures` through the
 * public proxy must answer 403/404 for a caller outside the internal network.
 *
 * The shell's `/api` proxy strips the `/api` prefix, so without an edge rule
 * `/api/internal/erasures` reaches the service's `/internal/erasures` mount. The edge
 * (Caddy, the only published entry point) must therefore refuse `/api/internal*` itself.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

/** Lines of the `{$DOMAIN} {` site block (brace-depth aware), in order. */
function publicSiteLines(caddyfile: string): string[] {
  const lines = caddyfile.split("\n");
  const start = lines.findIndex((l) => /^\{\$DOMAIN\}\s*\{/.test(l.trim()));
  if (start < 0) throw new Error("Caddyfile has no {$DOMAIN} site block");
  const out: string[] = [];
  let depth = 0;
  for (const raw of lines.slice(start)) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    out.push(line);
    if (depth <= 0) break;
  }
  return out;
}

describe("internal erasure route is not public (proxy)", () => {
  it("Caddy answers 403/404 for /api/internal* before the catch-all reverse proxy", () => {
    const site = publicSiteLines(read("deploy/azure/Caddyfile"));
    const guard = site.findIndex((l) => /^(handle|route|@\w+\s+path)\b.*\/api\/internal/.test(l) || /\/api\/internal\*?/.test(l));
    expect(guard, "no Caddy rule matching /api/internal*").toBeGreaterThanOrEqual(0);
    const after = site.slice(guard, guard + 4).join("\n");
    expect(after, "the /api/internal rule must respond 403 or 404").toMatch(/respond\b[^\n]*\b(403|404)\b/);
    const catchAll = site.findIndex((l) => /^handle\s*\{/.test(l));
    expect(catchAll).toBeGreaterThan(guard);
  });

  it("no published port exposes conversation-service directly", () => {
    const compose = read("deploy/azure/docker-compose.yml");
    const block = /^ {2}conversation-service:\n((?: {4,}.*\n|\n)*)/m.exec(compose)?.[1] ?? "";
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/^\s+ports:/m);
  });
});

describe("internal erasure route is not reachable without the service token", () => {
  it("/api/internal/erasures (unstripped) is 403/404 on the service itself", async () => {
    const { app, erasureRepo } = buildTestApp();
    const res = await request(app).post("/api/internal/erasures").send({ userId: "u1", email: "u1@example.com" });
    expect([403, 404]).toContain(res.status);
    expect(erasureRepo.calls).toHaveLength(0);
  });

  it("/internal/erasures without the token never erases (401/403/404)", async () => {
    const { app, erasureRepo } = buildTestApp();
    const res = await request(app).post("/internal/erasures").send({ userId: "u1", email: "u1@example.com" });
    expect([401, 403, 404]).toContain(res.status);
    expect(erasureRepo.calls).toHaveLength(0);
  });
});
