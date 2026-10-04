import type { Principal } from "../shared/auth-middleware.js";

/** Test principal whose email matches the `tokenFor(userId)` JWTs the route specs sign; verified
 * unless `emailVerified: false` is passed (AICHAT-253). */
export function asUser(userId: string, options: { emailVerified?: boolean; email?: string } = {}): Principal {
  return { userId, email: options.email ?? `${userId}@example.com`, emailVerified: options.emailVerified ?? true };
}
