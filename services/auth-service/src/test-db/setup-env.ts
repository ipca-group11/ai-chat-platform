/**
 * Setup file of the database tests: the values the service modules need at import time.
 * DATABASE_URL is not set here, the Testcontainers global setup provides it.
 */
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.INTERNAL_SERVICE_TOKEN ??= "test-internal-service-token-0123456789";
process.env.COOKIE_SECURE ??= "true";
process.env.LOG_LEVEL ??= "silent";
