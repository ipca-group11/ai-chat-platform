export const meta = {
  name: "nfr-testing",
  description:
    "Non-functional requirements testing: discover NFRs, plan measurable checks, implement, run, refute failures, report",
  whenToUse:
    "Test the non-functional requirements (performance, security, accessibility, resilience, load, privacy, bundle size, coverage) of this repo. args: { root?, categories?, constraints?, rounds? }",
  phases: [
    { title: "Discover", detail: "one agent per NFR category: existing requirements, tests, CI jobs, gaps" },
    { title: "Plan", detail: "measurable thresholds, tool and owned paths per category" },
    { title: "Implement", detail: "one agent per category writes or extends the checks, in parallel" },
    { title: "Run", detail: "execute each category and capture evidence" },
    { title: "Verify", detail: "skeptics refute each failure, fixers repair confirmed defects" },
    { title: "Report", detail: "docs/NFR-REPORT.md with pass/fail per requirement and open gaps" },
  ],
};

const {
  root = ".",
  categories = [
    "performance",
    "bundle-size",
    "load",
    "security",
    "accessibility",
    "resilience",
    "privacy",
    "observability",
    "coverage",
  ],
  constraints = "",
  rounds = 2,
} = args || {};

const CTX = `ROOT: ${root}
${constraints}
Rules: work only inside ROOT. Do NOT commit or push. TypeScript only (no new .js/.mjs; scripts run as node *.ts).
No browser e2e runs (disabled locally and in CI). No mentions of AI or co-author trailers in any file you write.
Prefer the repo's existing tools and CI jobs (see .github/workflows, TESTING.md, docs/) over adding new ones.
Return raw data, not prose for a human.`;

// ---------- schemas ----------
const DISCOVER = {
  type: "object",
  properties: {
    category: { type: "string" },
    requirements: { type: "array", items: { type: "string" } },
    existing: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: ["category", "requirements", "existing", "gaps"],
};
const PLAN = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          category: { type: "string" },
          requirement: { type: "string" },
          threshold: { type: "string" },
          tool: { type: "string" },
          owns: { type: "string" },
          run: { type: "string" },
        },
        required: ["key", "category", "requirement", "threshold", "tool", "owns", "run"],
      },
    },
  },
  required: ["summary", "items"],
};
const RES = {
  type: "object",
  properties: { summary: { type: "string" }, files: { type: "array", items: { type: "string" } } },
  required: ["summary"],
};
const RUN = {
  type: "object",
  properties: {
    passing: { type: "boolean" },
    measured: { type: "string" },
    evidence: { type: "string" },
    failures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          file: { type: "string" },
          why: { type: "string" },
        },
        required: ["title", "why"],
      },
    },
  },
  required: ["passing", "measured", "failures"],
};
const VERD = {
  type: "object",
  properties: { real: { type: "boolean" }, kind: { type: "string" }, why: { type: "string" } },
  required: ["real"],
};
const OK = {
  type: "object",
  properties: { passing: { type: "boolean" }, summary: { type: "string" } },
  required: ["passing", "summary"],
};

// ---------- Discover ----------
phase("Discover");
const found = (
  await parallel(
    categories.map(
      (c) => () =>
        agent(
          `${CTX}\nYOU ARE THE NFR SCOUT for category "${c}".
Find in ${root}: the stated non-functional requirements (README, TESTING.md, docs/, Jira epics in docs/AICHAT-*), the tests and CI jobs that already cover them, and the gaps.
Read real files; do not guess. Keep each item to one line.`,
          { label: `discover:${c}`, phase: "Discover", schema: DISCOVER },
        ),
    ),
  )
).filter(Boolean);
log(`Discover: ${found.length}/${categories.length} categories, ${found.reduce((n, d) => n + d.gaps.length, 0)} gaps`);

// ---------- Plan ----------
phase("Plan");
const plan = await agent(
  `${CTX}\nYOU ARE THE NFR PLANNER. Inputs:\n${JSON.stringify(found)}
Produce one plan item per testable requirement. Each needs a MEASURABLE threshold (e.g. "p95 < 300 ms", "LCP < 2.5 s", "0 critical a11y violations"), the tool, the exact command to run it ("run"), and "owns": a disjoint path glob so implementers never touch the same file.
Skip requirements that are already covered and passing; plan only gaps and weak checks. Write docs/NFR-PLAN.md.`,
  { label: "planner", phase: "Plan", schema: PLAN },
);
if (!plan || !plan.items.length) return { status: "nothing to do", discovered: found };
log(`Plan: ${plan.summary} | ${plan.items.length} items`);

// ---------- Implement -> Run -> Verify, per item, no barrier ----------
const refuteAndFix = (item, failures) =>
  pipeline(
    [failures],
    (fs) =>
      parallel(
        fs.map(
          (f) => () =>
            agent(
              `${CTX}\nSKEPTIC for "${item.key}". A run of "${item.run}" reported a failure: "${f.title}" (${f.file || ""}) ${f.why}
Decide: is this a REAL violation of the requirement "${item.requirement}" (threshold ${item.threshold}), or a flaky/wrong test, wrong threshold, or environment issue?
Re-run it if needed. Default real=false if uncertain. kind = one of: product-defect, test-bug, flaky, environment.`,
              { label: `refute:${item.key}:${f.title.slice(0, 30)}`, phase: "Verify", schema: VERD },
            ).then((v) => ({ ...f, real: !!(v && v.real), kind: v && v.kind })),
        ),
      ),
    async (ver) => {
      const all = (ver || []).filter(Boolean);
      const real = all.filter((f) => f.real);
      const notReal = all.filter((f) => !f.real);
      if (!real.length) return { key: item.key, confirmed: 0, fixed: 0, dismissed: notReal.length };
      const fix = await agent(
        `${CTX}\nFIXER for "${item.key}" (owns ${item.owns}). Fix the cause of these confirmed violations, then re-run "${item.run}":\n${real.map((f) => `- ${f.title} (${f.file || ""}): ${f.why}`).join("\n")}
If fixing needs a product change outside ${item.owns}, make the smallest change and say so. Never loosen a threshold to make it pass.`,
        { label: `fix:${item.key}`, phase: "Verify", schema: OK },
      );
      return {
        key: item.key,
        confirmed: real.length,
        fixed: fix && fix.passing ? real.length : 0,
        note: fix && fix.summary,
        dismissed: notReal.length,
      };
    },
  ).then((r) => r[0]);

const results = await pipeline(
  plan.items,
  (it) =>
    agent(
      `${CTX}\nYOU ARE THE IMPLEMENTER "${it.key}". You OWN ONLY: ${it.owns}.
Requirement: ${it.requirement}\nThreshold: ${it.threshold}\nTool: ${it.tool}\nRun command: ${it.run}
Write or extend the automated check so it FAILS when the threshold is violated and passes otherwise. Wire it into the repo's scripts (and CI only if a matching workflow exists). Do not run it yet.`,
      { label: `implement:${it.key}`, phase: "Implement", schema: RES },
    ),
  (impl, it) =>
    agent(
      `${CTX}\nYOU ARE THE RUNNER for "${it.key}". Run: ${it.run}
Report the measured value against the threshold (${it.threshold}), save raw output under docs/nfr-evidence/${it.key}/ (logs, JSON, screenshots), and list every failure.`,
      { label: `run:${it.key}`, phase: "Run", schema: RUN },
    ),
  async (run, it) => {
    if (!run) return { key: it.key, category: it.category, status: "run failed to return" };
    let current = run;
    let verified = { confirmed: 0, fixed: 0, dismissed: 0 };
    for (let r = 0; r < rounds && !current.passing && current.failures.length; r++) {
      const v = await refuteAndFix(it, current.failures);
      verified = {
        confirmed: verified.confirmed + v.confirmed,
        fixed: verified.fixed + v.fixed,
        dismissed: verified.dismissed + v.dismissed,
      };
      if (!v.confirmed) {
        current = { ...current, passing: true, failures: [] };
        break;
      }
      const rerun = await agent(
        `${CTX}\nRE-RUN "${it.key}": ${it.run}. Report measured value and remaining failures.`,
        { label: `rerun:${it.key}:r${r}`, phase: "Run", schema: RUN },
      );
      if (!rerun) break;
      current = rerun;
    }
    return {
      key: it.key,
      category: it.category,
      requirement: it.requirement,
      threshold: it.threshold,
      measured: current.measured,
      passing: current.passing,
      remaining: current.failures,
      ...verified,
    };
  },
);
const done = results.filter(Boolean);
log(`Run/Verify: ${done.filter((r) => r.passing).length}/${done.length} requirements passing`);

// ---------- Report ----------
phase("Report");
const report = (await agent(
  `${CTX}\nYOU ARE THE NFR REPORTER. Results:\n${JSON.stringify(done)}\nGaps found at discovery:\n${JSON.stringify(found.map((d) => ({ c: d.category, gaps: d.gaps })))}
Write docs/NFR-REPORT.md: a table per category (requirement, threshold, measured, pass/fail, evidence path), the defects found and fixed, the failures dismissed as flaky/test bugs, and what is still open. Report only what the results show.`,
  { label: "report", phase: "Report", schema: RES },
)) || { summary: "report agent returned nothing" };

return {
  categories: found.map((d) => d.category),
  items: plan.items.length,
  passing: done.filter((r) => r.passing).length,
  failing: done.filter((r) => !r.passing).map((r) => ({ key: r.key, measured: r.measured, remaining: r.remaining })),
  confirmedDefects: done.reduce((n, r) => n + (r.confirmed || 0), 0),
  fixed: done.reduce((n, r) => n + (r.fixed || 0), 0),
  report: report.summary,
};
