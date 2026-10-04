// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = join(__dirname, 'styles');
const css = readFileSync(join(styles, 'fonts.css'), 'utf-8');
const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1] as string);

describe('self-hosted fonts (AICHAT-230)', () => {
  it('declares Inter and JetBrains Mono from local files only', () => {
    expect(css).toMatch(/font-family: 'Inter'/);
    expect(css).toMatch(/font-family: 'JetBrains Mono'/);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^\.\/fonts\/[\w-]+\.woff2$/);
  });

  it('ships every font file it references, and the licence', () => {
    for (const url of urls) expect(existsSync(join(styles, url)), url).toBe(true);
    expect(readFileSync(join(styles, 'fonts/OFL.txt'), 'utf-8')).toContain('SIL Open Font License');
  });
});
