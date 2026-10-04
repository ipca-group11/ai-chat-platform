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

describe("deploy/azure/Caddyfile keeps service-only routes private", () => {
  const privatePaths = site.match(/^\s*@private path (.+)$/m)?.[1]?.split(/\s+/) ?? [];

  it("answers 404 for /api/metrics* (AICHAT-229)", () => {
    expect(privatePaths).toContain("/api/metrics*");
  });

  it("answers 404 for /api/internal and everything under it (AICHAT-248)", () => {
    expect(privatePaths).toEqual(expect.arrayContaining(["/api/internal", "/api/internal/*"]));
  });

  it("handles the private paths before any proxy", () => {
    expect(block(site, "handle @private {").trim()).toBe("respond 404");
    expect(site.indexOf("handle @private")).toBeLessThan(site.indexOf("reverse_proxy"));
  });
});

describe("deploy/azure/Caddyfile access log keeps no personal data (AICHAT-232)", () => {
  const accessLog = block(caddyfile, "(access_log) {");

  it("is imported by the site block and every remote", () => {
    expect(site).toMatch(/^\s*import access_log$/m);
    expect(remote).toMatch(/^\s*import access_log$/m);
  });

  it.each(["remote_ip", "client_ip"])("truncates request>%s to its network", (field) => {
    expect(accessLog).toMatch(new RegExp(`request>${field} ip_mask \\{\\s*ipv4 16\\s*ipv6 32\\s*\\}`));
  });

  it("drops the query string from the logged URI", () => {
    expect(accessLog).toContain('request>uri regexp "\\?.*$" ""');
  });

  it.each(["Referer", "X-Forwarded-For", "X-Real-Ip", "Forwarded"])("deletes the %s header", (header) => {
    expect(accessLog).toMatch(new RegExp(`request>headers>${header} delete`));
  });

  it("deletes a redirect's Location, which can carry a full URL", () => {
    expect(accessLog).toMatch(/resp_headers>Location delete/);
  });
});

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

  it("the CSP allows no font or style host besides our own (fonts are self-hosted, AICHAT-230)", () => {
    expect(shell).toMatch(/font-src 'self';/);
    expect(shell).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it("the remotes stay loadable from the shell's origin (CORP cross-origin)", () => {
    expect(remote).toMatch(/Cross-Origin-Resource-Policy "cross-origin"/);
    expect(remote).toMatch(/Access-Control-Allow-Origin "https:\/\/{\$DOMAIN}"/);
  });
});
