import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '@platform/test-utils';
import { http, HttpResponse, recordRequests, server } from '@platform/test-utils/msw';
import { SESSION_QUERY_KEY, useSession } from './useSession';

describe('useSession', () => {
  it('reports loading, then the signed-in user when GET /auth/me succeeds', async () => {
    server.use(http.get('*/auth/me', () => HttpResponse.json({ id: 'u1', email: 'ana@example.com' })));
    const { result } = renderHookWithClient(() => useSession());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toMatchObject({ email: 'ana@example.com' });
  });

  it('unwraps a `{ user }` envelope', async () => {
    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ user: { userId: 'u2', email: 'bo@example.com' } })),
    );
    const { result } = renderHookWithClient(() => useSession());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.data).toEqual({ userId: 'u2', email: 'bo@example.com' });
  });

  it('treats a 401 as "not signed in" instead of a query error', async () => {
    server.use(http.get('*/auth/me', () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })));
    const { result, queryClient } = renderHookWithClient(() => useSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.status).toBe('success');
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('surfaces other failures (500) as a query error and stays unauthenticated', async () => {
    server.use(http.get('*/auth/me', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const { result, queryClient } = renderHookWithClient(() => useSession());

    await waitFor(() => expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.status).toBe('error'));
    expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.error).toMatchObject({ status: 500 });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('re-checks the session each time a guarded page mounts', async () => {
    const requests = recordRequests();
    const { queryClient } = renderHookWithClient(() => useSession());
    await waitFor(() => expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeTruthy());

    renderHookWithClient(() => useSession(), { queryClient });

    await waitFor(() => expect(requests.filter((r) => r.url.endsWith('/auth/me'))).toHaveLength(2));
  });

  it('keeps the cache key stable, since the layout writes to it on logout', () => {
    expect(SESSION_QUERY_KEY).toEqual(['auth', 'me']);
  });
});
