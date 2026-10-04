import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/lighthouse.yml` and `lighthouserc.json` (AICHAT-62, AICHAT-80): the
 * Lighthouse CI job must run on the same triggers as DAST against the mock stack, assert a budget for every page,
 * fail the job when one is exceeded, keep its reports as an artifact and always tear the stack down. Marking the job
 * as a required check is a branch-protection setting (unavailable on this private free-plan repository), so it is a
 * team rule written in the workflow header; this suite only checks the workflow produces that check.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const workflow = read(".github/workflows/lighthouse.yml");
const dast = read(".github/workflows/dast.yml");
const config = JSON.parse(read("lighthouserc.json")) as {
  ci: {
    collect: { url: string[]; numberOfRuns: number; settings: { preset: string } };
    assert: { assertMatrix: { matchingUrlPattern: string; aggregationMethod: string; assertions: Record<string, [string, { maxNumericValue: number }]> }[] };
    upload: { target: string };
  };
};

/** The `on:` block of a workflow, without the comments. */
const triggers = (text: string): string => /^on:\n((?: {2}.*\n|\n|#.*\n)+)/m.exec(text)?.[1]?.replace(/^\s*#.*$/gm, "") ?? "";

describe("Lighthouse CI workflow (AICHAT-80)", () => {
  it("runs on pull requests to main, on pushes to the integration branch and main, and on demand", () => {
    expect(workflow).toMatch(/pull_request:\s*\n\s+branches: \[main\]/);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[integration\/testing-epics, main\]/);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/schedule:/);
  });

  it("has the same pull request and push triggers as the DAST workflow", () => {
    for (const trigger of ["pull_request:\n    branches: [main]", "push:\n    branches: [integration/testing-epics, main]"]) {
      expect(triggers(dast)).toContain(trigger);
      expect(triggers(workflow)).toContain(trigger);
    }
  });

  it("starts the compose stack with the LLM mock and waits for it with a bound", () => {
    expect(workflow).toMatch(/pnpm mock:up/);
    expect(workflow).toMatch(/seq 1 \d+/);
    expect(workflow).toContain("http://localhost:8000/");
  });

  it("runs the audit through testing/lighthouse/run.sh, which exits with the code of lhci", () => {
    expect(workflow).toContain("run: bash testing/lighthouse/run.sh");
    expect(read("testing/lighthouse/run.sh")).toContain("exec node scripts/lighthouse/run.ts");
    expect(read("scripts/lighthouse/run.ts")).toMatch(/process\.exit\(status\)/);
    expect(read("scripts/lighthouse/run.ts")).toContain("'autorun'");
  });

  it("keeps the HTML reports and the summary as a build artifact even when the audit fails", () => {
    expect(workflow).toMatch(/if:\s*always\(\)\s*\n\s+uses: actions\/upload-artifact@v4/);
    expect(workflow).toContain("lighthouse-results/lhci/*.html");
    expect(workflow).toContain("lighthouse-results/summary.md");
  });

  it("tears the stack down even if the job fails", () => {
    expect(workflow).toMatch(/if:\s*always\(\)\s*\n\s+run: pnpm mock:down/);
  });

  it("documents the required-check team rule and only audits the local stack", () => {
    expect(workflow).toContain('"lighthouse / budgets"');
    expect(workflow).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i);
  });
});

describe("Lighthouse budgets (AICHAT-45, AICHAT-62)", () => {
  const { collect, assert, upload } = config.ci;
  const limits = (url: string) => {
    const entry = assert.assertMatrix.find((e) => new RegExp(e.matchingUrlPattern).test(url));
    expect(entry, url).toBeDefined();
    const max = (audit: string) => entry?.assertions[audit]?.[1].maxNumericValue;
    return { lcp: max("largest-contentful-paint"), tbt: max("total-blocking-time"), cls: max("cumulative-layout-shift"), entry };
  };

  it("audits the five pages, 3 runs each, with the desktop preset", () => {
    expect(collect.url.map((u) => decodeURI(new URL(u).pathname))).toEqual(["/login", "/register", "/chats", "/chats/{CHAT_ID}", "/settings"]);
    expect(collect.numberOfRuns).toBe(3);
    expect(collect.settings.preset).toBe("desktop");
    expect(upload.target).toBe("filesystem");
  });

  it("asserts the approved budgets as errors on the median", () => {
    for (const path of ["login", "register"]) {
      expect(limits(`http://localhost:8000/${path}`)).toMatchObject({ lcp: 2000, tbt: 200, cls: 0.05 });
    }
    for (const path of ["chats", "chats/some-chat-id", "settings"]) {
      expect(limits(`http://localhost:8000/${path}`)).toMatchObject({ lcp: 2500, tbt: 300, cls: 0.1 });
    }
    for (const entry of assert.assertMatrix) {
      expect(entry.aggregationMethod).toBe("median");
      for (const [level] of Object.values(entry.assertions)) expect(level).toBe("error");
    }
  });

  it("keeps /chats and /chats/:id in different patterns from /login", () => {
    expect(limits("http://localhost:8000/chats").entry).toBe(limits("http://localhost:8000/chats/abc").entry);
    expect(limits("http://localhost:8000/login").entry).not.toBe(limits("http://localhost:8000/chats").entry);
  });

  it("keeps no session cookie in the committed config", () => {
    expect(read("lighthouserc.json")).not.toMatch(/access_token|extraHeaders|eyJ/);
  });
});
