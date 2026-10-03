/**
 * Vitest global setup: ensures required environment variables have a value before any
 * module (e.g. `shared/env.ts`, `shared/prisma.ts`) is imported by a test file, without
 * overriding values a test intentionally sets itself beforehand.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/auth_test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.COOKIE_SECURE ??= "true";
process.env.LOG_LEVEL ??= "silent";
