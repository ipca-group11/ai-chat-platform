// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'styles/globals.css'), 'utf-8');

function extractBlock(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `expected to find a "${selector} {" block in globals.css`).toBeGreaterThan(-1);
  const end = source.indexOf('}', start);
  return source.slice(start, end);
}

function customPropertyNames(block: string): string[] {
  return Array.from(block.matchAll(/--([a-z0-9-]+):/g)).map((m) => m[1] ?? '');
}

// AC-16: "Components are themed with Tailwind design tokens for color, spacing,
// radius, and typography, and support both light and dark mode."
//
// Component-level tests elsewhere assert that components consume semantic,
// token-driven utility classes (e.g. `bg-primary`, `text-muted-foreground`). This
// test covers the other half of that criterion at the token-definition level: every
// color token defined for light mode (`:root`) must have a corresponding override in
// dark mode (`.dark`), so switching themes (as Storybook's preview toolbar and, per
// the design, the shell app's theme toggle do) actually re-themes every component
// rather than silently falling back to a light-only value.
describe('design tokens: light/dark parity (AC-16)', () => {
  const root = customPropertyNames(extractBlock(css, ':root'));
  const dark = customPropertyNames(extractBlock(css, '.dark'));

  it('AC-16: defines at least one color token in :root (light mode)', () => {
    expect(root.length).toBeGreaterThan(0);
  });

  it('AC-16: defines a .dark override for every color token declared in :root', () => {
    const colorTokens = root.filter((name) => name !== 'radius' && !name.startsWith('font-'));
    const missing = colorTokens.filter((name) => !dark.includes(name));
    expect(missing).toEqual([]);
  });

  it('AC-16: .dark does not introduce tokens that do not exist in :root (light mode)', () => {
    const extra = dark.filter((name) => !root.includes(name));
    expect(extra).toEqual([]);
  });
});

// AICHAT-174: WCAG 2.2 AA contrast (1.4.3) between every text token and the surface the components draw it on.
// The axe scan of the running app (AICHAT-173) found `--destructive`, `--success` and `--muted-foreground` below
// 4.5:1; this test checks the same pairs straight from the token values, without a browser.

/** Reads `--name: H S% L%` from a block and converts it to sRGB (0-255). */
function tokenRgb(block: string, name: string): [number, number, number] {
  const match = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(block);
  expect(match, `expected --${name} in the block`).not.toBeNull();
  const [h, s, l] = [Number(match?.[1]), Number(match?.[2]) / 100, Number(match?.[3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [channel(0), channel(8), channel(4)];
}

/** WCAG 2 relative luminance and contrast ratio. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** [text token, surface token, where the pair is used]. */
const textPairs: [string, string, string][] = [
  ['foreground', 'background', 'body text'],
  ['muted-foreground', 'background', 'descriptions, placeholders'],
  ['muted-foreground', 'muted', 'tabs, avatar, selected list row'],
  ['destructive', 'background', 'field errors (FormField)'],
  ['destructive', 'card', 'Alert variant="destructive"'],
  ['destructive-foreground', 'destructive', 'Button, Badge, Toast variant="destructive"'],
  ['success', 'card', 'Alert variant="success"'],
  ['success-foreground', 'success', 'Badge, Toast variant="success"'],
  ['primary-foreground', 'primary', 'Button default'],
  ['secondary-foreground', 'secondary', 'Button secondary'],
  ['accent-foreground', 'accent', 'hover and selected items'],
];

describe('design tokens: text contrast meets WCAG 2.2 AA, 4.5:1 (AICHAT-174)', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', '.dark']] as const) {
    const block = extractBlock(css, selector);
    it.each(textPairs)(`${theme}: --%s on --%s (%s)`, (text, surface) => {
      const ratio = contrast(tokenRgb(block, text), tokenRgb(block, surface));
      expect(ratio, `${theme} --${text} on --${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
