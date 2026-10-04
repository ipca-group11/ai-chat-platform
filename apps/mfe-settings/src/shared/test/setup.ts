import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";

// Registers `toHaveNoViolations` for the accessibility check of each component state (see `a11y.ts`).
expect.extend(axeMatchers);
