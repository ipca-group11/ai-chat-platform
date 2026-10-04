import { afterEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '@platform/test-utils';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './queryClient';

describe('shell queryClient', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('is a QueryClient with the shell defaults (one retry, no refetch on window focus)', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      retry: 1,
      refetchOnWindowFocus: false,
    });
  });

  it('is a singleton: importing the module again yields the same instance (AC-25)', async () => {
    const again = await import('./queryClient');
    expect(again.queryClient).toBe(queryClient);
  });

  it('retries a failing query once before reporting the error', async () => {
    let calls = 0;
    const { result } = renderHookWithClient(
      () =>
        useQuery({
          queryKey: ['always-fails'],
          queryFn: () => {
            calls += 1;
            return Promise.reject(new Error('down'));
          },
        }),
      { queryClient },
    );

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(calls).toBe(2);
    expect(result.current.error).toMatchObject({ message: 'down' });
  });
});
