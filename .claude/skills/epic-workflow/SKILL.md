---
name: epic-workflow
description: Orchestrate an AICHAT testing epic (AICHAT-17..34, AICHAT-144) — move it to In Progress in Jira, run the Definition of Ready review by asking the owner questions, then delegate each story to a small-context subagent that implements it, captures evidence (screenshots/logs) and writes its WORKLOG section. Use for "start epic AICHAT-NN", "next epic", "continue AICHAT-NN", "/epic-workflow". Each epic also has its own skill `aichat-<n>-<slug>` with the epic-specific facts.
---

# Epic workflow — orchestrator

Human-readable version of the process: `docs/EPIC-WORKFLOW.md`. Epic-specific facts (story keys, acceptance
criteria, DoR questions, context loaders): `.claude/skills/aichat-<n>-*/SKILL.md`. Load **only** the epic skill
for the epic being worked on.

## Context budget rules (save tokens)

The main thread is a thin orchestrator. It owns Jira, the questions to the owner, and the git branch. All reading
of code and all implementation happens in subagents that get **only** what they need.

1. Main thread never reads a whole epic README, source trees, or agent transcripts. It reads: the epic skill, the
   WORKLOG §1 (decisions), and the ≤10-line reports agents return.
2. One subagent per story (`subagent_type: general-purpose`). The prompt is built from the template below and
   contains: story key + acceptance criteria verbatim, the decisions that apply, and the **context loader commands**
   (awk ranges) from the epic skill for just the sections the story needs — never pasted README text.
3. Pick the cheapest model that can do the job: `haiku` for documentation-only, evidence formatting, Jira-free
   checks; `sonnet` for code, tests, CI config. Use the main model only if a story failed once with `sonnet`. Bulk Jira edits (many MCP calls) go to `sonnet`: `haiku` tends to stop part-way; always tell the agent the exact count and to verify it.
4. Stories with no dependency on each other run **in parallel**, each with `isolation: "worktree"` when they edit
   code; dependent stories run in order. Never two agents editing the same file at once.
5. Agents return a fixed short report (template below). Ask follow-ups with SendMessage to the same agent instead
   of starting a new one, so its context is reused.
6. Jira calls stay in the main thread (they are small). Use ADF for descriptions; the markdown converter breaks
   task lists containing inline code.
7. After all stories: one `haiku` reviewer agent checks the WORKLOG for missing sections, broken image links and
   forbidden words (see Authorship), and returns only the problems.

## Fixed facts

- Jira cloudId `436aa6ed-4a2a-4c54-b40f-3490773ebd63`, project `AICHAT`, owner accountId `5b83bde0332df52a5d945bc3`.
- Transitions: `21` In Progress, `31` Review, `41` Done, `11` back to TODO.
- Impediment flag: `editJiraIssue` fields `{"customfield_10021":[{"value":"Impediment"}]}`.
- Evidence helper: `node scripts/evidence/term-shot.mjs --out docs/AICHAT-<n>/evidence --name <nn>-<what> -- <cmd>`
  (writes `.log` + terminal-style `.png`, keeps the exit code). Browser evidence: chrome-devtools `take_screenshot`
  with `filePath` into the same folder.

## Authorship (mandatory)

University coursework presented as the owner's work. Deliverables (docs, code, comments, Jira text, commits, PRs,
screenshots) never mention AI, assistants, Claude, agents, skills or "generated". No `Co-Authored-By` trailer and
no "Generated with" line in commits or PRs — the owner's instruction overrides the default attribution. Team voice
("We added…"). Screenshots show only the command and its output. The reviewer agent greps for
`-i 'claude|anthropic|\bAI\b|assistant|generated|agent|skill'` in the epic's docs.

## Procedure

### 1. Start (main thread)
1. Read the epic skill. If another epic is In Progress without an impediment flag, ask before starting this one.
2. `transitionJiraIssue` `21` on the epic. JQL `parent = AICHAT-<n>` → all stories assigned to the owner; fix if not.
3. Comment on the epic: `Started <YYYY-MM-DD>. Work log: docs/AICHAT-<n>/WORKLOG.md`.

### 2. DoR review (main thread — always ask, never assume)
1. Use the question list in the epic skill. Ask with **AskUserQuestion** (≤4 per call, 2–4 options each, recommended
   option first with "(Recommended)"). Always include a scope-confirmation question.
2. Write the answers in WORKLOG §1 (create the WORKLOG from `docs/templates/WORKLOG.md` first).
3. Update the Jira epic: tick met DoR items (ADF), comment with the decisions.
4. Anything still blocked → flag Impediment, comment what is missing, tell the owner, stop this epic.

### 3. Setup (main thread)
`git fetch origin && git switch <branch from epic skill> && git merge origin/integration/testing-epics` (epic branches already exist on origin, cut from `integration/testing-epics`); `mkdir -p docs/AICHAT-<n>/evidence`;
capture versions: `term-shot … --name 00-environment -- "node -v; pnpm -v; docker --version"`.

### 4. Story loop (subagents)
For each story (order from the epic skill; parallel where independent):
1. Main: transition story `21`.
2. Main: spawn the agent with the prompt template.
3. Agent: implement, run, capture evidence, write its WORKLOG section, commit. Returns the short report.
4. Main: tick acceptance criteria in Jira (ADF), transition `31`. Push / PR (base `integration/testing-epics`, never `main`) only after the owner agrees. `41` after merge.
5. If the agent reports an unsettled decision: ask the owner (AskUserQuestion), then SendMessage the answer to the same agent.

#### Agent prompt template (keep it this short)

```
Repo: /Users/truezone/Projects/ai-chat-platform (branch <branch>). Story <JIRA-KEY> (<epic>-US<k>): <summary>.
Acceptance criteria:
<verbatim from epic skill>
Decisions that apply: <1–5 lines from WORKLOG §1>
Load only this context: <1–3 awk commands from the epic skill's context loaders>; then open only the files those sections reference.
Do:
1. Implement the story. Small commits, Conventional Commits, body "Refs: <JIRA-KEY>". No co-author/generated trailers.
2. Run it. Capture evidence with: node scripts/evidence/term-shot.mjs --out docs/<epic>/evidence --name <nn>-<what> -- <cmd>
   (also capture an expected failure if the story adds a gate).
3. Write section "### US<k> · <summary>" in docs/<epic>/WORKLOG.md §3 using the template headings (What and why, Files,
   How to run, How to repeat it manually, Result with ![](evidence/…) images, Problems and fixes). Team voice; never
   mention AI, assistants or tools that wrote the text.
4. If a decision is missing, stop and report it instead of guessing.
Report back in ≤10 lines: status (done/blocked), commits, files, evidence files, open question (if any).
```

### 5. Close (main thread + one haiku reviewer)
1. Reviewer agent: check WORKLOG completeness, image links, forbidden words; fix nothing, list problems.
2. Main: fix problems (or SendMessage the story agent), fill DoD table and "Notes for the report", update the status
   in `docs/AICHAT-EPICS.md`.
3. Epic → `31` with a summary comment (WORKLOG link, PRs). → `41` when the owner accepts.
