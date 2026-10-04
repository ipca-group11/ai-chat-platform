import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.ts";

/** The Alloy pipeline without its `//` comments. */
const alloy = readRepoFile("observability/alloy.alloy")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");

describe("AICHAT-233: the Faro pipeline stores no client address", () => {
  it("keeps the request headers (X-Forwarded-For) out of the pipeline", () => {
    expect(alloy).toMatch(/^\s*include_metadata\s*=\s*false$/m);
  });

  it("promotes only kind and app_name to Loki labels", () => {
    const labels = [...alloy.matchAll(/stage\.labels\s*{\s*values\s*=\s*{([^}]*)}/g)].map((m) => m[1] ?? "");
    expect(labels).toHaveLength(1);
    expect([...(labels[0] ?? "").matchAll(/"([^"]+)"\s*=/g)].map((m) => m[1])).toEqual(["kind", "app_name"]);
  });

  it("adds no extra labels and no structured metadata", () => {
    expect(alloy).not.toMatch(/extra_log_labels|stage\.structured_metadata|stage\.static_labels/);
  });

  it("Caddy strips the forwarding headers before /collect reaches Alloy", () => {
    const caddyfile = readRepoFile("deploy/azure/Caddyfile");
    const collect = caddyfile.slice(caddyfile.indexOf("handle /collect*"), caddyfile.indexOf("handle {"));
    for (const header of ["X-Forwarded-For", "X-Real-Ip", "Forwarded"]) {
      expect(collect).toMatch(new RegExp(`header_up -${header}$`, "m"));
    }
  });
});
