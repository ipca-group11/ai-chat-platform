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
