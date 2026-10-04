import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANARY, TEST_SYSTEM_PROMPT } from "./canary.ts";

const repo = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, repo)), "utf-8");

describe("red-team test stack (compose.redteam.yaml)", () => {
  const compose = read("compose.redteam.yaml");

  it("plants the same system prompt the assertions look for", () => {
    expect(compose).toContain(`SYSTEM_PROMPT: "${TEST_SYSTEM_PROMPT}"`);
    expect(TEST_SYSTEM_PROMPT).toContain(CANARY);
  });

  it("serves the attack pages read-only from the folder the team owns, on loopback only", () => {
    expect(compose).toContain("./testing/promptfoo/pages:/usr/share/nginx/html:ro");
    expect(compose).toMatch(/"127\.0\.0\.1:\$\{ATTACK_PAGES_PORT:-8090\}:80"/);
  });

  it("lets the model fetch only the attack pages, so an injected fetch to the attacker is refused (AICHAT-242)", () => {
    expect(compose).toContain("WEB_FETCH_ALLOWED_DOMAINS: ${REDTEAM_WEB_FETCH_ALLOWED_DOMAINS:-attack-pages}");
  });

  it("is only used on top of the mock stack, never by the plain compose file", () => {
    expect(read("compose.yaml")).not.toContain("SYSTEM_PROMPT");
    expect(read("scripts/mock-compose.sh")).toContain("compose.redteam.yaml");
  });

  it("keeps the canary the mock scenario leaks equal to the one the assertions check", () => {
    expect(read("testing/mock-server/src/llm/scenarios.ts")).toContain(`INJECTION_CANARY = "${CANARY}"`);
  });
});
