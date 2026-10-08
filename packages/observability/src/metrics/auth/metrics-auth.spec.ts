import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * H7: /metrics must not be reachable unauthenticated through the public route. The only
 * public entry point is Caddy, so the Caddyfile is resolved the way Caddy would for a
 * request to /metrics (first matching `handle` wins) and the outcome must be 401/403/404.
 * No service other than Caddy may publish a port on a public interface.
 */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

const DENY = new Set([401, 403, 404]);
const METRICS_PATHS = ["/metrics", "/metrics/", "/metrics?x=1"];

interface Handle {
  matcher: string | undefined;
  body: string[];
}

/** Returns the body lines of the site block opened by `{$DOMAIN} {`. */
function siteBlock(caddyfile: string): string[] {
  const lines = caddyfile.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => /^\{\$DOMAIN\}\s*\{$/.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  let depth = 1;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("#")) continue;
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (depth <= 0) break;
    out.push(line);
  }
  return out;
}

/** Splits a site block into its top-level `handle [matcher] { ... }` directives. */
function handles(site: string[]): Handle[] {
  const result: Handle[] = [];
  let current: Handle | undefined;
  let depth = 0;
  for (const line of site) {
    if (depth === 0) {
      const m = /^handle(?:\s+(\S+))?\s*\{$/.exec(line);
      if (m) {
        current = { matcher: m[1], body: [] };
        result.push(current);
        depth = 1;
      }
      continue;
    }
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (depth <= 0) {
      depth = 0;
      current = undefined;
    } else current?.body.push(line);
  }
  return result;
}

function matches(matcher: string | undefined, path: string): boolean {
  if (matcher === undefined || matcher === "*") return true;
  const p = path.split("?")[0] ?? path;
  if (matcher.endsWith("*")) return p.startsWith(matcher.slice(0, -1));
  return p === matcher;
}

type Outcome = { kind: "status"; status: number } | { kind: "proxy"; target: string };

function outcome(h: Handle): Outcome {
  for (const line of h.body) {
    const respond = /^respond\b.*?\b([1-5]\d\d)\b\s*$/.exec(line) ?? /^respond\s+([1-5]\d\d)\b/.exec(line);
    if (respond) return { kind: "status", status: Number(respond[1]) };
    const abort = /^abort\b/.exec(line);
    if (abort) return { kind: "status", status: 404 };
    const proxy = /^reverse_proxy\s+(\S+)/.exec(line);
    if (proxy) return { kind: "proxy", target: proxy[1] ?? "" };
  }
  return { kind: "proxy", target: "(fallthrough)" };
}

function publicRoute(path: string): Outcome | undefined {
  const handle = handles(siteBlock(read("deploy/azure/Caddyfile"))).find((h) =>
    matches(h.matcher, path),
  );
  return handle ? outcome(handle) : undefined;
}

describe("metrics-auth: /metrics is not public (H7)", () => {
  it("parses the public site block with a catch-all route", () => {
    const hs = handles(siteBlock(read("deploy/azure/Caddyfile")));
    expect(hs.length).toBeGreaterThan(0);
    expect(hs.some((h) => h.matcher === undefined)).toBe(true);
  });

  it.each(METRICS_PATHS)("unauthenticated GET %s via the public route -> 401/403/404", (path) => {
    const result = publicRoute(path);
    expect(result, `no route resolves ${path}`).toBeDefined();
    expect(
      result?.kind === "status" && DENY.has(result.status),
      `public route proxies ${path} upstream instead of denying it: ${JSON.stringify(result)}`,
    ).toBe(true);
  });

  it("the remote ports do not expose /metrics either", () => {
    const text = read("deploy/azure/Caddyfile");
    expect(text).not.toMatch(/handle\s+\/metrics[^\n]*\{\s*\n\s*reverse_proxy/);
  });

  it("only the Caddy service publishes ports on a public interface", () => {
    const lines = read("deploy/azure/docker-compose.yml").split("\n");
    let service = "";
    let inServices = false;
    let inPorts = false;
    const exposed: string[] = [];
    for (const line of lines) {
      if (/^services:\s*$/.test(line)) inServices = true;
      else if (/^\S/.test(line)) inServices = false;
      if (!inServices) continue;
      const svc = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (svc) {
        service = svc[1] ?? "";
        inPorts = false;
        continue;
      }
      if (/^ {4}ports:\s*$/.test(line)) {
        inPorts = true;
        continue;
      }
      if (inPorts) {
        const item = /^\s+-\s*"?([^"\s#]+)"?/.exec(line);
        if (item) {
          const spec = item[1] ?? "";
          if (!spec.startsWith("127.0.0.1:") && service !== "caddy") exposed.push(`${service}: ${spec}`);
        } else if (/^ {4}\S/.test(line)) inPorts = false;
      }
    }
    expect(exposed).toEqual([]);
  });
});
