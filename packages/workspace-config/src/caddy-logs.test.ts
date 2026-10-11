import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.js";

interface Block {
  name: string;
  lines: string[];
}

/** Splits a Caddyfile into top-level blocks (snippets and site blocks) by brace depth. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let current: Block | undefined;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const bare = line.replace(/\{\$[A-Za-z_]+\}/g, "");
    if (depth === 0 && bare.endsWith("{")) {
      current = { name: line.slice(0, -1).trim(), lines: [] };
      blocks.push(current);
      depth = 1;
      continue;
    }
    if (current) current.lines.push(line);
    depth += (bare.match(/{/g) ?? []).length - (bare.match(/}/g) ?? []).length;
    if (depth <= 0) {
      depth = 0;
      current = undefined;
    }
  }
  return blocks;
}

/** Lines of a block with `import <snippet>` directives expanded. */
function expand(block: Block, all: Block[], seen = new Set<string>()): string[] {
  const out: string[] = [];
  for (const line of block.lines) {
    const imp = /^import\s+(\S+)/.exec(line);
    if (imp) {
      const snippet = all.find((b) => b.name === `(${imp[1]})`);
      if (snippet && !seen.has(snippet.name)) {
        seen.add(snippet.name);
        out.push(...expand(snippet, all, seen));
      }
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Violations of the log-minimisation rules for one site's effective config. */
function violations(lines: string[]): string[] {
  const found: string[] = [];
  const logStart = lines.findIndex((l) => l === "log {" || l === "log");
  if (logStart === -1) return ["no log directive (access log format not verifiable)"];
  const body = lines.slice(logStart).join("\n");
  if (!/format\s+filter\b/.test(body)) found.push("log format is not a filter (raw fields are logged)");
  if (!/request>uri\s+(delete|query\b|regexp\b)/.test(body)) found.push("query string is not stripped from request>uri");
  if (/request>uri\s+query\s*\{[^}]*\b(replace|hash)\b/.test(body)) found.push("query values are only replaced/hashed, not removed");
  for (const field of ["remote_ip", "client_ip"]) {
    if (!new RegExp(`request>${field}\\s+(delete|hash|ip_mask)\\b`).test(body)) found.push(`request>${field} is logged raw`);
  }
  if (!/request>headers>X-Forwarded-For\s+(delete|hash|ip_mask)\b/i.test(body)) found.push("X-Forwarded-For header is logged raw");
  return found;
}

describe("Caddy access logs minimised (privacy)", () => {
  const blocks = parseBlocks(readRepoFile("deploy/azure/Caddyfile"));
  const sites = blocks.filter((b) => !b.name.startsWith("("));

  it("defines site blocks", () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it("every site logs with 0 query strings and 0 raw client IPs", () => {
    const all: string[] = [];
    for (const site of sites) for (const v of violations(expand(site, blocks))) all.push(`${site.name}: ${v}`);
    expect(all).toEqual([]);
  });

  it("detector flags a raw default log format", () => {
    expect(violations(["log {", "output stdout", "}"]).length).toBeGreaterThan(0);
    expect(violations(["reverse_proxy x:1"])).toHaveLength(1);
  });
});
