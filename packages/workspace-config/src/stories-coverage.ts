// Which UI files (every .tsx of the apps and of the design system) have a story, and so a DOM
// snapshot through the project's stories.snapshot.test.tsx (docs/AICHAT-20, component snapshots).
// The few files that cannot have a story of their own are listed in
// packages/workspace-config/stories-exempt.json. Used by the guard test (stories-coverage.test.ts).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./repo.ts";

export const STORIES_EXEMPT_FILE = "packages/workspace-config/stories-exempt.json";
export const SNAPSHOT_RUNNER = "src/stories.snapshot.test.tsx";

/**
 * - `covered-by`: renders nothing of its own (route wiring); the story in `coveredBy` mounts
 *   it, so its output is in that story's snapshot.
 * - `bootstrap`: only mounts the app into the page (main.tsx, remote-entry.tsx).
 */
export const STORY_CATEGORIES: readonly string[] = ["covered-by", "bootstrap"];

export interface StoryExemptEntry {
  path?: unknown;
  category?: unknown;
  coveredBy?: unknown;
  reason?: unknown;
}

const PROJECTS = /^(apps\/[^/]+|packages\/ui)\/src\//;
const NOT_UI = [
  /\.(test|spec)\.tsx$/,
  /\.stories\.tsx$/,
  /(^|\/)stories-support\.tsx$/,
  /(^|\/)(test|test-utils)\//, // test helpers
];

/** The .tsx files of the apps and of packages/ui that must have a story, sorted. */
export function listUiFiles(root: string = repoRoot): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages/ui"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((f) => PROJECTS.test(f) && f.endsWith(".tsx") && !NOT_UI.some((re) => re.test(f)))
    .filter((f) => existsSync(join(root, f)))
    .sort();
}

/** `Button.tsx` -> `Button.stories.tsx`. */
export function siblingStory(file: string): string {
  return file.replace(/\.tsx$/, ".stories.tsx");
}

/** `apps/shell/src/x/y.tsx` -> `apps/shell`. */
function projectOf(file: string): string {
  return PROJECTS.exec(file)?.[1] ?? "";
}

export function loadStoryExempt(root: string = repoRoot): StoryExemptEntry[] {
  return JSON.parse(readFileSync(join(root, STORIES_EXEMPT_FILE), "utf8")).entries as StoryExemptEntry[];
}

/** Problems with the exempt list: bad shape, duplicates, gone files, files that now have a story. */
export function validateStoryExempt(entries: StoryExemptEntry[], files: string[], root: string = repoRoot): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (typeof e.path !== "string" || !e.path) {
      problems.push(`entry without a path: ${JSON.stringify(e)}`);
      continue;
    }
    if (seen.has(e.path)) problems.push(`${e.path}: listed twice`);
    seen.add(e.path);
    if (!STORY_CATEGORIES.includes(e.category as string))
      problems.push(`${e.path}: category must be one of ${STORY_CATEGORIES.join(", ")}`);
    if (typeof e.reason !== "string" || e.reason.trim().length < 10) problems.push(`${e.path}: missing reason`);
    if (e.category === "covered-by") {
      if (typeof e.coveredBy !== "string" || !e.coveredBy.endsWith(".stories.tsx"))
        problems.push(`${e.path}: covered-by needs coveredBy, the story file that renders it`);
      else if (!existsSync(join(root, e.coveredBy))) problems.push(`${e.path}: ${e.coveredBy} does not exist`);
    }
    if (!files.includes(e.path)) problems.push(`${e.path}: not a UI file (moved, deleted or excluded); remove the entry`);
    else if (existsSync(join(root, siblingStory(e.path)))) problems.push(`${e.path}: exempt but has its own story; remove the entry`);
  }
  return problems;
}

/** UI files with neither a sibling story nor an exempt entry. */
export function filesWithoutStory(files: string[], entries: StoryExemptEntry[], root: string = repoRoot): string[] {
  const exempt = new Set<unknown>(entries.map((e) => e.path));
  return files.filter((f) => !exempt.has(f) && !existsSync(join(root, siblingStory(f))));
}

/** Projects with UI files but no snapshot runner, so their stories would not be snapshotted. */
export function projectsWithoutRunner(files: string[], root: string = repoRoot): string[] {
  return [...new Set(files.map(projectOf))].filter((p) => !existsSync(join(root, p, SNAPSHOT_RUNNER))).sort();
}

/** Everything the guard fails on, as readable lines. Empty means every UI file is snapshotted. */
export function storyGuardProblems(root: string = repoRoot): string[] {
  const files = listUiFiles(root);
  const entries = loadStoryExempt(root);
  return [
    ...filesWithoutStory(files, entries, root).map(
      (f) => `${f}: no ${siblingStory(f).split("/").pop()} and no entry in ${STORIES_EXEMPT_FILE}; add a story next to it`,
    ),
    ...projectsWithoutRunner(files, root).map((p) => `${p}: has UI files but no ${SNAPSHOT_RUNNER}`),
    ...validateStoryExempt(entries, files, root),
  ];
}
