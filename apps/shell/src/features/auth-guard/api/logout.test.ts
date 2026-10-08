import { describe, expect, it } from 'vitest';
import { http, HttpResponse, recordRequests, server } from '@platform/test-utils/msw';
import { logout } from './logout';

describe('logout', () => {
  it('posts to /auth/logout with a correlation id and resolves on 204', async () => {
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));
    const requests = recordRequests();

    await expect(logout()).resolves.toBeUndefined();

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(['POST /auth/logout']);
    expect(requests[0]?.headers.get('X-Correlation-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects with the status when auth-service fails (the layout still clears the session)', async () => {
    server.use(
      http.post('*/auth/logout', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 }),
      ),
    );

    await expect(logout()).rejects.toMatchObject({ status: 500 });
  });
});
