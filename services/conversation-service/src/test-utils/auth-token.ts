import jwt from "jsonwebtoken";

// Fixed signing key for in-process tests, not a credential.
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
export const TEST_JWT_SECRET = "test-secret";

/** A signed access token whose email claim matches `asUser(userId)`. */
export function tokenFor(userId: string, secret: string = TEST_JWT_SECRET): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, secret, { expiresIn: "15m" });
}

/** The `Cookie` header value for supertest's `.set("Cookie", ...)`. */
export function cookieFor(userId: string): string[] {
  return [`access_token=${tokenFor(userId)}`];
}

/** Service token of the internal routes in tests, not a credential. */
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
export const TEST_SERVICE_TOKEN = "test-service-token-0123456789-abcdef";
