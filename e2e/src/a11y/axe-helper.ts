// Named import: @axe-core/playwright's default-export type declaration does
// not resolve correctly under NodeNext moduleResolution's dual CJS/ESM
// declaration files, even though the runtime export works either way.
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Minimal shape of the axe-core result we care about, kept small and
 * dependency-free so the filtering logic below is unit-testable without a
 * real browser page. */
export interface AxeViolation {
  id: string;
  impact?: "minor" | "moderate" | "serious" | "critical" | null;
  description: string;
  nodes: { target: readonly unknown[] }[];
}

export interface AxeResults {
  violations: AxeViolation[];
}

const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

/**
 * Pure filter used by `assertNoCriticalA11yViolations` below: AC-99 requires
 * zero *critical* accessibility violations; we also treat "serious" as
 * blocking since axe-core reserves "critical" for a narrow subset of rules.
 */
export function filterBlockingViolations(results: AxeResults): AxeViolation[] {
  return results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""));
}

export function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => node.target.map((t) => String(t)).join(" "))
        .join(", ");
      return `[${violation.impact}] ${violation.id}: ${violation.description} (${targets})`;
    })
    .join("\n");
}

/**
 * Runs axe-core against the given page and fails the test if any
 * critical/serious violation is found. Scoped to `#root`/`main` landmark by
 * default when a selector is provided, otherwise scans the whole page.
 */
export async function assertNoCriticalA11yViolations(
  page: Page,
  options: { include?: string } = {},
): Promise<void> {
  const builder = new AxeBuilder({ page });
  if (options.include) {
    builder.include(options.include);
  }
  const results = await builder.analyze();
  const blocking = filterBlockingViolations(results);

  expect(blocking, formatViolations(blocking)).toEqual([]);
}
