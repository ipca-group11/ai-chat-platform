import { correlationHeaderMatcher, errorResponseMatcher, like, newConsumerPact, runWithMockServer } from '@platform/pact-config';
import { describe, expect, it } from 'vitest';
import { logout } from './logout';
import { fetchSession } from './useSession';

// Contract shell -> auth-service (AICHAT-178): the route guard's session check and the
// nav bar's logout. The shell never calls /auth/refresh.
const pact = newConsumerPact('shell', 'auth-service');

const correlation = { 'X-Correlation-Id': correlationHeaderMatcher() };

describe('shell -> auth-service', () => {
  it('GET /auth/me returns the logged-in user', async () => {
    pact
      .given('a user is logged in', { email: 'alice@example.com' })
      .uponReceiving('a session check from the shell')
      .withRequest({ method: 'GET', path: '/auth/me', headers: correlation })
      .willRespondWith({ status: 200, headers: correlation, body: { id: like('user-1'), email: like('alice@example.com') } });

    await expect(runWithMockServer(pact, () => fetchSession())).resolves.toEqual({ id: 'user-1', email: 'alice@example.com' });
  });

  it('GET /auth/me without a session is a 401, which the guard reads as "logged out"', async () => {
    pact
      .given('no user is logged in')
      .uponReceiving('a session check from the shell without a session')
      .withRequest({ method: 'GET', path: '/auth/me', headers: correlation })
      .willRespondWith({ status: 401, headers: correlation, body: errorResponseMatcher({ code: 'UNAUTHENTICATED' }) });

    await expect(runWithMockServer(pact, () => fetchSession())).resolves.toBeNull();
  });

  it('POST /auth/logout answers 204', async () => {
    pact
      .given('a user is logged in', { email: 'alice@example.com' })
      .uponReceiving('a logout from the shell')
      .withRequest({ method: 'POST', path: '/auth/logout', headers: correlation })
      .willRespondWith({ status: 204, headers: correlation });

    await expect(runWithMockServer(pact, () => logout())).resolves.toBeUndefined();
  });
});
