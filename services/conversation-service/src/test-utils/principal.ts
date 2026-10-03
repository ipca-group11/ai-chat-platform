import type { Principal } from "../shared/auth-middleware.js";

/** Test principal whose email matches the `tokenFor(userId)` JWTs the route specs sign. */
export function asUser(userId: string): Principal {
  return { userId, email: `${userId}@example.com` };
}
