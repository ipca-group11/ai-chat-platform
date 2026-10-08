import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.js";

const REQUIRED_HEADERS = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
] as const;

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

/** Header names set by a block, following `import <snippet>` directives. */
function headersOf(block: Block, all: Block[], seen = new Set<string>()): Set<string> {
  const found = new Set<string>();
  for (const line of block.lines) {
    const imp = /^import\s+(\S+)/.exec(line);
    if (imp) {
      const snippet = all.find((b) => b.name === `(${imp[1]})`);
      if (snippet && !seen.has(snippet.name)) {
        seen.add(snippet.name);
        for (const h of headersOf(snippet, all, seen)) found.add(h);
      }
      continue;
    }
    const m = /^(?:header\s+)?[?+]?([A-Za-z][A-Za-z-]*)\s+"/.exec(line);
    if (m?.[1]) found.add(m[1].toLowerCase());
  }
  return found;
}

describe("Caddyfile security headers (H8)", () => {
  const blocks = parseBlocks(readRepoFile("deploy/azure/Caddyfile"));
  const sites = blocks.filter((b) => !b.name.startsWith("("));

  it("defines site blocks", () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it("every site block sends CSP, HSTS, X-Frame-Options and X-Content-Type-Options (0 missing)", () => {
    const missing: string[] = [];
    for (const site of sites) {
      const have = headersOf(site, blocks);
      for (const h of REQUIRED_HEADERS) {
        if (!have.has(h.toLowerCase())) missing.push(`${site.name}: ${h}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
