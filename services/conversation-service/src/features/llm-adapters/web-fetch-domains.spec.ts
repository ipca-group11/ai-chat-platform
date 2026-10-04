import { describe, expect, it } from "vitest";
import { isUrlAllowed, parseDomainList, webFetchDomainParams } from "./web-fetch-domains.js";

describe("parseDomainList (AICHAT-242)", () => {
  it("splits on commas and spaces, lower-cases, drops a leading *. and duplicates", () => {
    expect(parseDomainList("Example.com, *.docs.python.org  example.com.\nen.wikipedia.org")).toEqual([
      "example.com",
      "docs.python.org",
      "en.wikipedia.org",
    ]);
  });

  it("is undefined for an unset or empty value", () => {
    expect(parseDomainList(undefined)).toBeUndefined();
    expect(parseDomainList(" , ")).toBeUndefined();
  });

  it.each(["https://example.com", "example.com/docs", "example.com:8080", "exa_mple", "-bad.com", "a..b"])("rejects %s", (entry) => {
    expect(() => parseDomainList(entry)).toThrow(/not a domain name/);
  });
});

describe("isUrlAllowed (AICHAT-242)", () => {
  it("allows everything without a list", () => {
    expect(isUrlAllowed("https://attacker.example/log", {})).toBe(true);
  });

  it("with an allow-list, allows the domains and their subdomains only", () => {
    const policy = { allowed: ["example.com"] };
    expect(isUrlAllowed("https://example.com/a", policy)).toBe(true);
    expect(isUrlAllowed("https://docs.EXAMPLE.com./a", policy)).toBe(true);
    expect(isUrlAllowed("https://notexample.com", policy)).toBe(false);
    expect(isUrlAllowed("https://example.com.attacker.example", policy)).toBe(false);
    expect(isUrlAllowed("https://attacker.example/log?c=example.com", policy)).toBe(false);
  });

  it("with a block-list, refuses the domains and their subdomains only", () => {
    const policy = { blocked: ["attacker.example"] };
    expect(isUrlAllowed("https://attacker.example/log", policy)).toBe(false);
    expect(isUrlAllowed("https://x.attacker.example", policy)).toBe(false);
    expect(isUrlAllowed("https://example.com", policy)).toBe(true);
  });

  it("never allows a URL it cannot parse", () => {
    expect(isUrlAllowed("not a url", {})).toBe(false);
  });
});

describe("webFetchDomainParams (AICHAT-242)", () => {
  it("maps the policy to the fields of Anthropic's web fetch tool", () => {
    expect(webFetchDomainParams({})).toEqual({});
    expect(webFetchDomainParams({ allowed: ["example.com"] })).toEqual({ allowed_domains: ["example.com"] });
    expect(webFetchDomainParams({ blocked: ["attacker.example"] })).toEqual({ blocked_domains: ["attacker.example"] });
  });
});
