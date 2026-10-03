import { expect } from "vitest";
import { axe } from "vitest-axe";
import type { AxeMatchers } from "vitest-axe/matchers";

/**
 * Runs axe on the rendered DOM and fails with the list of violations (rule, impact, element).
 * The matcher is registered in `setup.ts`; it is typed here because the `Assertion` interfaces of
 * vitest and jest-dom do not allow a third declaration.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  (expect(await axe(container)) as unknown as AxeMatchers).toHaveNoViolations();
}
