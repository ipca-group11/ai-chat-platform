import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  STORIES_EXEMPT_FILE,
  filesWithoutStory,
  listUiFiles,
  projectsWithoutRunner,
  siblingStory,
  storyGuardProblems,
  validateStoryExempt,
} from "./stories-coverage.ts";

// The guard (docs/AICHAT-20, component snapshots): every UI file has a story next to it, so its
// DOM is snapshotted by the project's stories.snapshot.test.tsx, or an entry in stories-exempt.json.
describe("story guard on this repository", () => {
  it("finds no UI file without a story or an exempt entry, and no stale exempt entry", () => {
    expect(storyGuardProblems()).toEqual([]);
  });

  it("covers the apps and the design system, not their tests or stories", () => {
    const files = listUiFiles();
    expect(files).toContain("apps/mfe-chat/src/features/chat-view/components/ChatView.tsx");
    expect(files).toContain("packages/ui/src/components/button/button.tsx");
    expect(files.filter((f) => /\.(test|spec|stories)\.tsx$/.test(f))).toEqual([]);
  });
});

describe("the rules, on a scratch repository", () => {
  const root = mkdtempSync(join(tmpdir(), "story-guard-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const write = (rel: string, content: string = "export {};\n") => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };
  const reason = "Only mounts the app into the page.";

  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  write("apps/demo/src/Card.tsx");
  write("apps/demo/src/Card.stories.tsx");
  write("apps/demo/src/Card.test.tsx");
  write("apps/demo/src/List.tsx");
  write("apps/demo/src/main.tsx");
  write("apps/demo/src/routes.tsx");
  write("apps/demo/src/stories-support.tsx");
  write("apps/demo/src/test/renderWithRouter.tsx");
  write("apps/demo/src/model.ts");
  write("apps/demo/src/stories.snapshot.test.tsx");
  write("packages/ui/src/button.tsx");
  write("packages/other/src/Thing.tsx");

  it("lists the .tsx of apps and packages/ui only, without tests, stories, story support or test helpers", () => {
    expect(listUiFiles(root)).toEqual([
      "apps/demo/src/Card.tsx",
      "apps/demo/src/List.tsx",
      "apps/demo/src/main.tsx",
      "apps/demo/src/routes.tsx",
      "packages/ui/src/button.tsx",
    ]);
  });

  it("finds the files with no story and no exempt entry", () => {
    const entries = [{ path: "apps/demo/src/main.tsx", category: "bootstrap", reason }];
    expect(filesWithoutStory(listUiFiles(root), entries, root)).toEqual([
      "apps/demo/src/List.tsx",
      "apps/demo/src/routes.tsx",
      "packages/ui/src/button.tsx",
    ]);
  });

  it("names the story next to a file", () => {
    expect(siblingStory("apps/demo/src/List.tsx")).toBe("apps/demo/src/List.stories.tsx");
  });

  it("finds the projects whose stories no runner snapshots", () => {
    expect(projectsWithoutRunner(listUiFiles(root), root)).toEqual(["packages/ui"]);
  });

  it("accepts valid entries", () => {
    const entries = [
      { path: "apps/demo/src/main.tsx", category: "bootstrap", reason },
      { path: "apps/demo/src/routes.tsx", category: "covered-by", coveredBy: "apps/demo/src/Card.stories.tsx", reason },
    ];
    expect(validateStoryExempt(entries, listUiFiles(root), root)).toEqual([]);
  });

  it("rejects bad, duplicate, stale and unneeded entries", () => {
    const files = listUiFiles(root);
    const problems = validateStoryExempt(
      [
        { category: "bootstrap", reason },
        { path: "apps/demo/src/main.tsx", category: "bootstrap", reason },
        { path: "apps/demo/src/main.tsx", category: "bootstrap", reason },
        { path: "apps/demo/src/List.tsx", category: "skip", reason: "short" },
        { path: "apps/demo/src/routes.tsx", category: "covered-by", reason },
        { path: "packages/ui/src/button.tsx", category: "covered-by", coveredBy: "apps/demo/src/Gone.stories.tsx", reason },
        { path: "apps/demo/src/Gone.tsx", category: "bootstrap", reason },
        { path: "apps/demo/src/Card.tsx", category: "bootstrap", reason },
      ],
      files,
      root,
    );
    expect(problems).toEqual([
      expect.stringMatching(/^entry without a path/),
      "apps/demo/src/main.tsx: listed twice",
      "apps/demo/src/List.tsx: category must be one of covered-by, bootstrap",
      "apps/demo/src/List.tsx: missing reason",
      "apps/demo/src/routes.tsx: covered-by needs coveredBy, the story file that renders it",
      "packages/ui/src/button.tsx: apps/demo/src/Gone.stories.tsx does not exist",
      "apps/demo/src/Gone.tsx: not a UI file (moved, deleted or excluded); remove the entry",
      "apps/demo/src/Card.tsx: exempt but has its own story; remove the entry",
    ]);
  });

  it("reports everything in one list, naming the exempt file", () => {
    write(STORIES_EXEMPT_FILE, JSON.stringify({ version: 1, entries: [] }));
    const problems = storyGuardProblems(root);
    expect(problems).toContain(
      `apps/demo/src/List.tsx: no List.stories.tsx and no entry in ${STORIES_EXEMPT_FILE}; add a story next to it`,
    );
    expect(problems).toContain("packages/ui: has UI files but no src/stories.snapshot.test.tsx");
    expect(problems).toHaveLength(5);
  });
});
