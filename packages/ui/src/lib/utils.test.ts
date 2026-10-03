import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (AC-15 groundwork: shared class-name utility)', () => {
  it('AC-15: joins truthy class name inputs', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('AC-15: drops falsy/conditional inputs', () => {
    const isDisabled = false;
    const count = 0;
    expect(cn('a', isDisabled && 'b', undefined, null, count && 'c', 'd')).toBe('a d');
  });

  it('AC-15: resolves conflicting Tailwind utility classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('AC-15: merges class arrays and objects like clsx', () => {
    expect(cn(['a', { b: true, c: false }])).toBe('a b');
  });
});
