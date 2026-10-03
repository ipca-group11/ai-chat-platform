import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, recordRequests, server } from '@platform/test-utils/msw';
import { ApiError, apiFetch, isUnauthorizedError } from './apiClient';
import { CORRELATION_HEADER } from './constants';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed JSON body of a successful response', async () => {
    const me = await apiFetch<{ email: string }>('/auth/me');
    expect(me).toMatchObject({ email: expect.any(String) });
  });

  it('sends cookies with the request (httpOnly session cookie)', async () => {
    const requests = recordRequests();
    await apiFetch('/auth/me');
    expect(requests[0]!.credentials).toBe('include');
  });

  it('generates a correlation id when the caller did not pass one', async () => {
    const requests = recordRequests();
    await apiFetch('/auth/me');
    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the correlation id the caller provided', async () => {
    const requests = recordRequests();
    await apiFetch('/auth/me', { headers: { [CORRELATION_HEADER]: 'trace-1' } });
    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toBe('trace-1');
  });

  it('falls back to a generated v4-shaped id when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    const requests = recordRequests();
    await apiFetch('/auth/me');
    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('prefixes the path with baseUrl and forwards method and body', async () => {
    server.use(
      http.post('http://api.test/auth/logout', async ({ request }) =>
        HttpResponse.json({ got: await request.text() }),
      ),
    );
    const result = await apiFetch<{ got: string }>('/auth/logout', {
      baseUrl: 'http://api.test',
      method: 'POST',
      body: 'payload',
    });
    expect(result).toEqual({ got: 'payload' });
  });

  it('resolves to undefined on 204 No Content', async () => {
    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('rejects with an ApiError carrying the status and the response correlation id on non-2xx', async () => {
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({}, { status: 500, headers: { [CORRELATION_HEADER]: 'srv-42' } }),
      ),
    );

    const failure = apiFetch('/auth/me');

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      correlationId: 'srv-42',
      message: 'Request to /auth/me failed with status 500',
    });
  });

  it('leaves correlationId undefined when the server does not send one', async () => {
    server.use(http.get('*/auth/me', () => new HttpResponse(null, { status: 404 })));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 404, correlationId: undefined });
  });

  it('propagates network failures as they are', async () => {
    server.use(http.get('*/auth/me', () => HttpResponse.error()));
    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(TypeError);
  });
});

describe('isUnauthorizedError', () => {
  it('is true only for an ApiError with status 401', () => {
    expect(isUnauthorizedError(new ApiError('nope', 401))).toBe(true);
    expect(isUnauthorizedError(new ApiError('nope', 403))).toBe(false);
    expect(isUnauthorizedError(new Error('401'))).toBe(false);
    expect(isUnauthorizedError({ status: 401 })).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
  });
});
