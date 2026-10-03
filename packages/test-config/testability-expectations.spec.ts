import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * AC-94 ("Vitest unit tests cover business logic and each LLM provider adapter with the
 * LLMs mocked") is authored and owned by each domain pod inside its own
 * `apps/*`/`services/*` project (see this package's README "Testability expectations").
 * This pod's own, testable contribution to AC-94 is documenting that expectation clearly
 * enough that every pod applying this shared preset knows the bar, including the
 * LLM-mocking requirement for `conversation-service`'s provider adapters - this spec pins
 * that documentation down so it can't silently drift or be removed.
 */

const readmePath = fileURLToPath(new URL("./README.md", import.meta.url));
const readme = readFileSync(readmePath, "utf-8");

describe("test-config README testability expectations (AC-94)", () => {
  it("AC-94: documents that each pod owns its own business-logic unit tests", () => {
    expect(readme).toMatch(/AC-94/);
    expect(readme).toMatch(/business logic/i);
  });

  it("AC-94: documents that conversation-service must mock every LLM provider adapter", () => {
    expect(readme).toMatch(/mocks the LLM\/HTTP calls/i);
    expect(readme).toMatch(/OpenAI/);
    expect(readme).toMatch(/Anthropic/);
    expect(readme).toMatch(/no live\s+network calls/i);
  });
});
