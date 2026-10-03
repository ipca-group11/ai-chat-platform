import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AuthMeResponse, Session } from './session';

// `session.ts` only declares types, so there is nothing to execute: these checks pin the
// shape that `useSession` and `RequireAuth` rely on, and fail `tsc` if it drifts.
describe('session model (types)', () => {
  it('Session carries the user id and email', () => {
    expectTypeOf<Session>().toEqualTypeOf<{ userId: string; email: string }>();
  });

  it('AuthMeResponse wraps a Session in `user`', () => {
    expectTypeOf<AuthMeResponse>().toEqualTypeOf<{ user: Session }>();
    const response: AuthMeResponse = { user: { userId: 'u1', email: 'ana@example.com' } };
    expect(response.user.email).toBe('ana@example.com');
  });
});
