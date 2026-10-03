import jwt from "jsonwebtoken";

export const TEST_JWT_SECRET = "test-secret";

/** A signed access token whose email claim matches `asUser(userId)`. */
export function tokenFor(userId: string, secret: string = TEST_JWT_SECRET): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, secret, { expiresIn: "15m" });
}

/** The `Cookie` header value for supertest's `.set("Cookie", ...)`. */
export function cookieFor(userId: string): string[] {
  return [`access_token=${tokenFor(userId)}`];
}
