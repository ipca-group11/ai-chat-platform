/**
 * Polls a set of `/health` endpoints before the E2E suite starts, so specs
 * fail fast with a clear "stack not ready" error instead of racing a
 * slow-starting `docker compose up` (Postgres migrations, image builds,
 * etc.) with flaky timeouts inside the first test.
 */

export interface HealthTarget {
  name: string;
  url: string;
}

export interface WaitForStackOptions {
  /** Injectable fetch so this logic is unit-testable without a network. */
  fetchFn?: typeof fetch;
  /** Total time budget across all retries, in ms. */
  timeoutMs?: number;
  /** Delay between retries, in ms. */
  intervalMs?: number;
  /** Injectable sleep so tests don't need to wait in real time. */
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls a single health endpoint until it responds with an ok (2xx) status,
 * or throws once `timeoutMs` has elapsed.
 */
export async function waitForHealth(
  target: HealthTarget,
  options: WaitForStackOptions = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const sleepFn = options.sleepFn ?? defaultSleep;

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetchFn(target.url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${target.name} responded with status ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleepFn(intervalMs);
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${target.name} (${target.url}) to become healthy: ${reason}`,
  );
}

/** Waits for every target in parallel, surfacing all failures together. */
export async function waitForStack(
  targets: HealthTarget[],
  options: WaitForStackOptions = {},
): Promise<void> {
  const results = await Promise.allSettled(
    targets.map((target) => waitForHealth(target, options)),
  );

  const failures = results
    .map((result, index) => ({ result, target: targets[index] }))
    .filter(
      (entry): entry is { result: PromiseRejectedResult; target: HealthTarget } =>
        entry.result.status === "rejected",
    );

  if (failures.length > 0) {
    const message = failures
      .map(({ target, result }) => `- ${target?.name}: ${String(result.reason)}`)
      .join("\n");
    throw new Error(`One or more services are not healthy:\n${message}`);
  }
}

/**
 * Default set of health targets for the full `docker compose up` stack,
 * overridable via env vars for local runs against different ports.
 */
export function defaultStackTargets(): HealthTarget[] {
  return [
    { name: "shell", url: process.env["E2E_SHELL_HEALTH_URL"] ?? "http://localhost:4173/" },
    {
      name: "auth-service",
      url: process.env["E2E_AUTH_HEALTH_URL"] ?? "http://localhost:3001/health",
    },
    {
      name: "conversation-service",
      url: process.env["E2E_CONVERSATION_HEALTH_URL"] ?? "http://localhost:3002/health",
    },
  ];
}
