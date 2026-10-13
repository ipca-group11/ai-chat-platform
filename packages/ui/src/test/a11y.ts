import { expect } from 'vitest';
import { configureAxe } from 'vitest-axe';
import type { AxeMatchers } from 'vitest-axe/matchers';

// Two rules are off in component tests:
// - color-contrast: jsdom does no layout and draws no canvas, so axe cannot compute colours; contrast is checked from
//   the tokens (design-tokens.test.ts) and in the browser (e2e accessibility.spec.ts, AICHAT-173).
// - region ("content inside landmarks"): a page-level best-practice rule. A component rendered alone has no <main>, so
//   a popup in a portal always fails it; the pages are scanned with their landmarks in the e2e suite.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

/**
 * Runs axe on the rendered DOM and fails with the list of violations (rule, impact, element). Same helper as in
 * mfe-chat and mfe-settings (AICHAT-18-US5); dialogs and popups render in a portal, so pass `document.body` for them.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  (expect(await axe(container)) as unknown as AxeMatchers).toHaveNoViolations();
}
