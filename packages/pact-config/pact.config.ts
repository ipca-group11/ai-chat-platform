/**
 * Shared Pact.js setup (O5, AC-95): every `mfe-*` consumer test and every service's
 * provider-verification step configures Pact through these helpers so the pact directory,
 * log level, naming convention, and broker env vars are identical across pods.
 */

/** Directory Pact.js writes/reads generated contract files from, repo-root relative. */
export const PACT_DIR = "./pacts";

/** `pact-node`/`@pact-foundation/pact` log level; overridable via `PACT_LOG_LEVEL`. */
export const PACT_LOG_LEVEL = (process.env["PACT_LOG_LEVEL"] ?? "warn") as
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

/** Env var name holding the Pact Broker base URL, read by CI's publish/verify steps. */
export const PACT_BROKER_URL_ENV = "PACT_BROKER_URL";
/** Env var name holding the Pact Broker auth token. */
export const PACT_BROKER_TOKEN_ENV = "PACT_BROKER_TOKEN";

/**
 * Naming convention (AC-95): consumers are named after their MFE app
 * (`apps/mfe-<name>` -> `mfe-<name>`), providers after their service
 * (`services/<name>-service` -> `<name>-service`), so contract file names
 * (`<consumer>-<provider>.json`) and Pact Broker entries are predictable and greppable.
 */
export function consumerName(mfeName: string): string {
  return mfeName.startsWith("mfe-") ? mfeName : `mfe-${mfeName}`;
}

export function providerName(serviceName: string): string {
  return serviceName.endsWith("-service") ? serviceName : `${serviceName}-service`;
}

export interface PactConsumerOptions {
  consumer: string;
  provider: string;
  dir: string;
  logLevel: typeof PACT_LOG_LEVEL;
}

/**
 * Base options every consumer test's `new PactV3({ ...pactConsumerOptions(...) })` (or
 * equivalent) should spread, so `dir`/`logLevel` never drift between pods.
 */
export function pactConsumerOptions(consumer: string, provider: string): PactConsumerOptions {
  return {
    consumer: consumerName(consumer),
    provider: providerName(provider),
    dir: PACT_DIR,
    logLevel: PACT_LOG_LEVEL,
  };
}

export interface PactBrokerConfig {
  pactBrokerUrl: string;
  pactBrokerToken?: string;
}

/**
 * Reads the broker URL/token from the environment (unset in local dev, set in CI once a
 * broker is provisioned — see this pod's PLAN.md O5 "optional local Pact broker service"
 * note). Returns `undefined` when no broker is configured, so callers can fall back to
 * purely local contract generation/verification.
 */
export function pactBrokerConfig(): PactBrokerConfig | undefined {
  const pactBrokerUrl = process.env[PACT_BROKER_URL_ENV];
  if (!pactBrokerUrl) {
    return undefined;
  }
  const pactBrokerToken = process.env[PACT_BROKER_TOKEN_ENV];
  return pactBrokerToken ? { pactBrokerUrl, pactBrokerToken } : { pactBrokerUrl };
}
