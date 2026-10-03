import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentTheme, initTheme, setTheme } from './theme';

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('follows the system preference when the user has not picked a theme', () => {
    mockSystemDark(true);
    initTheme();
    expect(currentTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('keeps an explicit choice over the system preference', () => {
    mockSystemDark(true);
    setTheme('light');
    initTheme();
    expect(currentTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
