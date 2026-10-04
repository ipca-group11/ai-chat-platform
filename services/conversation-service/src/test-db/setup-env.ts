/**
 * Setup file of the database tests: the values the service modules need at import time.
 * DATABASE_URL is not set here, the Testcontainers global setup provides it.
 */
process.env.NODE_ENV ??= "test";
// Throwaway signing key of the test database, not a credential.
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
process.env.JWT_SECRET ??= "test-jwt-secret";
// Throwaway service token of the test database, not a credential.
// nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_secret
process.env.INTERNAL_SERVICE_TOKEN ??= "test-internal-service-token-0123456789";
process.env.COOKIE_SECURE ??= "true";
process.env.LOG_LEVEL ??= "silent";
