import { expect } from "vitest";
import { configureAxe } from "vitest-axe";
import type { AxeMatchers } from "vitest-axe/matchers";

// jsdom does no layout and draws no canvas, so axe cannot compute colours: the contrast rule is
// left to the browser checks (Playwright axe) and to the visual review.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

/**
 * Runs axe on the rendered DOM and fails with the list of violations (rule, impact, element).
 * The matcher is registered in `setup.ts`; it is typed here because the `Assertion` interfaces of
 * vitest and jest-dom do not allow a third declaration.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  (expect(await axe(container)) as unknown as AxeMatchers).toHaveNoViolations();
}
