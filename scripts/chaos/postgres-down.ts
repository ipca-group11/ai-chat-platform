#!/usr/bin/env node
// Chaos gate (res-chaos): stops Postgres for 30 s under the running compose stack, then fails when
//   crash      a service container exited, restarted or changed its StartedAt
//   errors     during the outage a service /health answered anything but a fast 503 (200 = lying
//              about the database, a hang or a refused connection = unclear error)
//   recovery   the services took 60 s or more to answer /health 200 after Postgres came back
//
//   node scripts/chaos/postgres-down.ts [--outage 30] [--max-recovery 60] [--max-error-ms 5000]
//     [--auth http://localhost:4001] [--conversation http://localhost:4002]
//   Stack up first: docker compose up -d --wait   (or pnpm load:up)

import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

export interface Thresholds {
  outageS: number;
  maxRecoveryS: number;
  maxErrorMs: number;
}

export const DEFAULTS: Thresholds = { outageS: 30, maxRecoveryS: 60, maxErrorMs: 5000 };

export interface Probe {
  /** HTTP status, 0 when the request failed or timed out. */
  status: number;
  ms: number;
}

export interface ContainerState {
  status: string;
  restartCount: number;
  startedAt: string;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Observation {
  /** Service name -> container state before the outage and after recovery. */
  before: Record<string, ContainerState>;
  after: Record<string, ContainerState>;
  /** Service name -> /health probes taken while Postgres was down. */
  outage: Record<string, Probe[]>;
  /** Seconds from `compose start postgres` until every service answered 200, null if never. */
  recoveryS: number | null;
}

export function evaluate(obs: Observation, t: Thresholds = DEFAULTS): Check[] {
  const checks: Check[] = [];
  for (const [svc, before] of Object.entries(obs.before)) {
    const after = obs.after[svc];
    const crashed =
      !after ||
      after.status !== "running" ||
      after.restartCount !== before.restartCount ||
      after.startedAt !== before.startedAt;
    checks.push({
      name: `crash:${svc}`,
      ok: !crashed,
      detail: after
        ? `status=${after.status} restarts ${before.restartCount}->${after.restartCount} startedAt ${before.startedAt === after.startedAt ? "unchanged" : "changed"}`
        : "container missing after the outage",
    });
  }
  for (const [svc, probes] of Object.entries(obs.outage)) {
    const bad = probes.filter((p) => p.status !== 503 || p.ms > t.maxErrorMs);
    checks.push({
      name: `errors:${svc}`,
      ok: probes.length > 0 && bad.length === 0,
      detail:
        probes.length === 0
          ? "no probes during the outage"
          : `${probes.length} probes, ${bad.length} not a 503 within ${t.maxErrorMs} ms${bad[0] ? ` (first: status ${bad[0].status}, ${bad[0].ms} ms)` : ""}`,
    });
  }
  checks.push({
    name: "recovery",
    ok: obs.recoveryS !== null && obs.recoveryS < t.maxRecoveryS,
    detail: obs.recoveryS === null ? `no 200 within ${t.maxRecoveryS} s` : `${obs.recoveryS.toFixed(1)} s (limit ${t.maxRecoveryS} s)`,
  });
  return checks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function probe(url: string, timeoutMs: number): Promise<Probe> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer();
    return { status: res.status, ms: Date.now() - start };
  } catch {
    return { status: 0, ms: Date.now() - start };
  }
}

function compose(...args: string[]): string {
  return execFileSync("docker", ["compose", ...args], { encoding: "utf8" }).trim();
}

function containerState(service: string): ContainerState {
  const id = compose("ps", "-aq", service).split("\n")[0] ?? "";
  if (!id) return { status: "missing", restartCount: -1, startedAt: "" };
  const [status = "", restarts = "-1", startedAt = ""] = execFileSync(
    "docker",
    ["inspect", "-f", "{{.State.Status}} {{.RestartCount}} {{.State.StartedAt}}", id],
    { encoding: "utf8" },
  )
    .trim()
    .split(" ");
  return { status, restartCount: Number(restarts), startedAt };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      outage: { type: "string", default: String(DEFAULTS.outageS) },
      "max-recovery": { type: "string", default: String(DEFAULTS.maxRecoveryS) },
      "max-error-ms": { type: "string", default: String(DEFAULTS.maxErrorMs) },
      auth: { type: "string", default: "http://localhost:4001" },
      conversation: { type: "string", default: "http://localhost:4002" },
    },
  });
  const t: Thresholds = {
    outageS: Number(values.outage),
    maxRecoveryS: Number(values["max-recovery"]),
    maxErrorMs: Number(values["max-error-ms"]),
  };
  const urls: Record<string, string> = {
    "auth-service": `${values.auth}/health`,
    "conversation-service": `${values.conversation}/health`,
  };

  for (const [svc, url] of Object.entries(urls)) {
    const p = await probe(url, t.maxErrorMs);
    if (p.status !== 200) {
      console.error(`precondition: ${svc} /health is ${p.status}, bring the stack up first`);
      return 2;
    }
  }

  const before = Object.fromEntries(Object.keys(urls).map((s) => [s, containerState(s)]));
  const outage: Record<string, Probe[]> = Object.fromEntries(Object.keys(urls).map((s) => [s, []]));
  let recoveryS: number | null = null;

  compose("stop", "postgres");
  try {
    const end = Date.now() + t.outageS * 1000;
    while (Date.now() < end) {
      await Promise.all(
        Object.entries(urls).map(async ([svc, url]) => {
          outage[svc]?.push(await probe(url, t.maxErrorMs * 2));
        }),
      );
      await sleep(1000);
    }
  } finally {
    compose("start", "postgres");
  }
  const restartedAt = Date.now();
  const deadline = restartedAt + t.maxRecoveryS * 1000;
  while (Date.now() < deadline) {
    const results = await Promise.all(Object.values(urls).map((u) => probe(u, 2000)));
    if (results.every((r) => r.status === 200)) {
      recoveryS = (Date.now() - restartedAt) / 1000;
      break;
    }
    await sleep(1000);
  }

  const after = Object.fromEntries(Object.keys(urls).map((s) => [s, containerState(s)]));
  const checks = evaluate({ before, after, outage, recoveryS }, t);
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
  return checks.every((c) => c.ok) ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
}
