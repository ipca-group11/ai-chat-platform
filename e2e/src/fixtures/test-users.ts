/**
 * Test-user helpers shared across the UC1-UC8 specs.
 *
 * Registration specs need a fresh, never-before-used email per run (the
 * service rejects duplicate emails per UC1/FR1), while login/isolation specs
 * want a stable, already-registered pair of users seeded ahead of time (or
 * lazily registered once per suite run via `ensureRegistered`).
 */

/** Password satisfying STACK.md decision #4 (>=8 chars, letter + number). */
export const VALID_PASSWORD = "Test1234pass";

/** Below the minimum length / missing a digit, per STACK.md decision #4. */
export const INVALID_PASSWORD = "short";

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Builds a unique email for a given test run so re-running the suite against
 * a persistent stack never collides with a previous run's registered user.
 */
export function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `${prefix}.${stamp}@e2e.example.com`;
}

export function freshUser(prefix = "user"): TestUser {
  return { email: uniqueEmail(prefix), password: VALID_PASSWORD };
}

/** Two independent users used by the UC7 isolation spec. */
export function isolationUsers(): { userA: TestUser; userB: TestUser } {
  return { userA: freshUser("user-a"), userB: freshUser("user-b") };
}
