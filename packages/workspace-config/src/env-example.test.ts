import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.ts";

/** Parses a dotenv-style file (KEY=value per line, `#` comments, blank lines) into a map. */
function parseDotenv(content: string) {
  const vars: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    vars[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return vars;
}

/** Every `${VAR:-default}` / `${VAR}` interpolation referenced anywhere in a string. */
function referencedEnvVars(content: string) {
  return [...content.matchAll(/\$\{([A-Z_][A-Z0-9_]*)(:-[^}]*)?\}/g)].map((m) => m[1] as string);
}

describe("AC-7: .env.example lists every environment variable needed by every service, with safe local defaults", () => {
  const env = parseDotenv(readRepoFile(".env.example"));
  const compose = parse(readRepoFile("compose.yaml"));

  // Empty on purpose: empty means "built-in system prompt" (AICHAT-243) and "no web fetch restriction"
  // (AICHAT-242); the services treat an empty value as unset.
  const emptyByDesign = new Set(["SYSTEM_PROMPT", "WEB_FETCH_ALLOWED_DOMAINS", "WEB_FETCH_BLOCKED_DOMAINS"]);

  it("AC-7: every variable is non-empty (a safe local default is present)", () => {
    expect(Object.keys(env).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(env)) {
      if (emptyByDesign.has(key)) continue;
      expect(value.trim().length, `${key} should have a non-empty default`).toBeGreaterThan(0);
    }
  });

  it("AC-7: every ${VAR:-default} referenced from compose.yaml is documented in .env.example", () => {
    const referenced = new Set<string>();
    for (const service of Object.values<{ environment?: Record<string, unknown>; ports?: unknown[] }>(compose.services)) {
      for (const value of Object.values(service.environment ?? {})) {
        if (typeof value === "string") {
          referencedEnvVars(value).forEach((v) => referenced.add(v));
        }
      }
      for (const port of service.ports ?? []) {
        referencedEnvVars(String(port)).forEach((v) => referenced.add(v));
      }
    }
    const undocumented = [...referenced].filter((v) => !(v in env));
    expect(undocumented).toEqual([]);
  });

  it("AC-7: documents core secrets/config every service needs (JWT, DB, uploads, correlation header)", () => {
    for (const key of [
      "JWT_SECRET",
      "AUTH_SERVICE_DATABASE_URL",
      "CONVERSATION_SERVICE_DATABASE_URL",
      "UPLOAD_DIR",
      "CORRELATION_HEADER",
    ]) {
      expect(env).toHaveProperty(key);
    }
  });
});
