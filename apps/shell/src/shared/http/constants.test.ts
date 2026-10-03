import { describe, expect, it } from 'vitest';
import { CORRELATION_HEADER } from './constants';

describe('http constants', () => {
  it('names the correlation header as the platform contract does (ARCHITECTURE.md section 7)', () => {
    expect(CORRELATION_HEADER).toBe('X-Correlation-Id');
  });

  it('is a valid HTTP header name, so it can be set on a request', () => {
    expect(() => new Headers({ [CORRELATION_HEADER]: 'abc' })).not.toThrow();
  });
});
