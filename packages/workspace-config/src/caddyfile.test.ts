import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.ts";

const caddyfile = readRepoFile("deploy/azure/Caddyfile");

/** The body of the first block opened by a line that starts with `header` (brace matched). */
function block(source: string, header: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith(header) && line.trim().endsWith("{"));
  if (start === -1) throw new Error(`no block "${header}" in the Caddyfile`);
  let depth = 0;
  const body: string[] = [];
  for (const line of lines.slice(start)) {
    depth += (line.match(/{(?!\$)/g) ?? []).length - (line.match(/(?<!{\$[A-Z_]*)}/g) ?? []).length;
    body.push(line);
    if (depth === 0) break;
  }
  return body.slice(1, -1).join("\n");
}

const site = block(caddyfile, "{$DOMAIN} {");
const shell = block(site, "handle {");
const remote = block(caddyfile, "(remote) {");
const security = block(caddyfile, "(security) {");

describe("deploy/azure/Caddyfile security headers (AICHAT-228)", () => {
  it.each([
    ["Strict-Transport-Security", /"max-age=\d+/],
    ["X-Content-Type-Options", /"nosniff"/],
    ["Referrer-Policy", /"strict-origin-when-cross-origin"/],
    ["Permissions-Policy", /"camera=\(\)/],
  ])("the security snippet sets %s", (name, value) => {
    expect(security).toMatch(new RegExp(`${name} ${value.source}`));
  });

  it("the site block and every remote import the security snippet", () => {
    expect(site).toMatch(/^\s*import security$/m);
    expect(remote).toMatch(/^\s*import security$/m);
    for (const port of [3001, 3002, 3003]) {
      expect(block(caddyfile, `{$DOMAIN}:${port} {`)).toMatch(/^\s*import remote$/m);
    }
  });

  it("the shell gets a report-only CSP, anti-framing and same-origin COOP/CORP", () => {
    expect(shell).toMatch(/Content-Security-Policy-Report-Only "default-src 'self';[^"]*frame-ancestors 'none'/);
    expect(shell).toMatch(/X-Frame-Options "DENY"/);
    expect(shell).toMatch(/Cross-Origin-Opener-Policy "same-origin"/);
    expect(shell).toMatch(/Cross-Origin-Resource-Policy "same-origin"/);
  });

  it("the remotes stay loadable from the shell's origin (CORP cross-origin)", () => {
    expect(remote).toMatch(/Cross-Origin-Resource-Policy "cross-origin"/);
    expect(remote).toMatch(/Access-Control-Allow-Origin "https:\/\/{\$DOMAIN}"/);
  });
});
