import jwt from "jsonwebtoken";

// Fixed signing key for in-process tests, not a credential.
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
export const TEST_JWT_SECRET = "test-secret";

/** A signed access token whose email claim matches `asUser(userId)`. The address counts as
 * verified unless `emailVerified: false` is passed (AICHAT-253). */
export function tokenFor(userId: string, secret: string = TEST_JWT_SECRET, options: { emailVerified?: boolean; email?: string } = {}): string {
  return jwt.sign(
    { sub: userId, email: options.email ?? `${userId}@example.com`, email_verified: options.emailVerified ?? true },
    secret,
    { expiresIn: "15m" },
  );
}

/** The `Cookie` header value for supertest's `.set("Cookie", ...)`. */
export function cookieFor(userId: string, options: { emailVerified?: boolean; email?: string } = {}): string[] {
  return [`access_token=${tokenFor(userId, TEST_JWT_SECRET, options)}`];
}

/** Service token of the internal routes in tests, not a credential. */
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
export const TEST_SERVICE_TOKEN = "test-service-token-0123456789-abcdef";
