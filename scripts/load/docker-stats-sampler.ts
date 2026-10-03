#!/usr/bin/env node
// Samples the CPU and memory of the stack's containers during a load run (AICHAT-24) and writes
// one CSV row per container per sample, so the numbers stay with the results.
//
//   node scripts/load/docker-stats-sampler.ts --out docs/AICHAT-24/results/streams_ramp-docker-stats.csv \
//     --interval 5 --duration 330
//
// Options:
//   --out <file>        CSV file (default: docker-stats.csv)
//   --interval <s>      seconds between two samples (default 5)
//   --duration <s>      stop after this many seconds (default: until Ctrl-C / SIGTERM)
//   --prefix <text>     only containers whose name starts with this (default: llm-chat-, the compose project)
//   --serve <port>      also serve the latest sample as Prometheus metrics on this port (Grafana
//                       dashboard "Load test"; Prometheus scrapes host.docker.internal:<port>)
//
// CPU is the percentage of ONE core as `docker stats` reports it (200 % = two cores busy); the
// limit columns come from compose.load.yaml, so mem_pct is the share of the container's limit.

import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const CSV_HEADER = "timestamp,container,cpu_pct,cpu_limit_cores,mem_mib,mem_limit_mib,mem_pct,net_rx_mb,net_tx_mb,pids";

const UNITS: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

/** "12.5MiB" -> bytes. Returns 0 for text it does not understand. */
export function parseSize(text: string): number {
  const match = /^\s*([\d.]+)\s*([a-zA-Z]+)\s*$/.exec(text);
  if (!match) return 0;
  return Number(match[1]) * (UNITS[(match[2] ?? "").toLowerCase()] ?? 0);
}

export interface Sample {
  timestamp: string;
  container: string;
  cpuPct: number;
  /** CPU limit in cores from compose.load.yaml (0 = no limit). */
  cpuLimitCores: number;
  memMiB: number;
  memLimitMiB: number;
  memPct: number;
  netRxMB: number;
  netTxMB: number;
  pids: number;
}

interface StatsRow {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  NetIO: string;
  PIDs: string;
}

/** One line of `docker stats --no-stream --format '{{json .}}'` -> a sample. */
export function parseRow(line: string, timestamp: string, cpuLimits: Record<string, number> = {}): Sample {
  const row = JSON.parse(line) as StatsRow;
  const [used = "", limit = ""] = row.MemUsage.split("/");
  const [rx = "", tx = ""] = row.NetIO.split("/");
  const memMiB = parseSize(used) / 1024 ** 2;
  const memLimitMiB = parseSize(limit) / 1024 ** 2;
  return {
    timestamp,
    container: row.Name,
    cpuPct: Number.parseFloat(row.CPUPerc) || 0,
    cpuLimitCores: cpuLimits[row.Name] ?? 0,
    memMiB,
    memLimitMiB,
    memPct: memLimitMiB > 0 ? (memMiB / memLimitMiB) * 100 : 0,
    netRxMB: parseSize(rx) / 1e6,
    netTxMB: parseSize(tx) / 1e6,
    pids: Number(row.PIDs) || 0,
  };
}

export function toCsvLine(s: Sample): string {
  const n = (value: number) => value.toFixed(2);
  return [s.timestamp, s.container, n(s.cpuPct), n(s.cpuLimitCores), n(s.memMiB), n(s.memLimitMiB), n(s.memPct), n(s.netRxMB), n(s.netTxMB), s.pids].join(",");
}

/** CPU limits (cores) of the running containers, from `docker inspect`. */
export function readCpuLimits(): Record<string, number> {
  const ids = spawnSync("docker", ["ps", "-q"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  if (ids.length === 0) return {};
  const inspect = spawnSync("docker", ["inspect", "--format", "{{.Name}} {{.HostConfig.NanoCpus}}", ...ids], { encoding: "utf8" });
  const limits: Record<string, number> = {};
  for (const line of inspect.stdout.split("\n")) {
    const [name, nano] = line.trim().split(" ");
    if (name && nano) limits[name.replace(/^\//, "")] = Number(nano) / 1e9;
  }
  return limits;
}

/** Latest samples as Prometheus text; `service` is the compose service (llm-chat-<service>-1). */
export function toPrometheus(samples: Sample[]): string {
  const lines: string[] = [];
  const metric = (name: string, help: string, value: (s: Sample) => number) => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
    for (const s of samples) {
      const service = s.container.replace(/^llm-chat-/, "").replace(/-\d+$/, "");
      lines.push(`${name}{service="${service}"} ${value(s)}`);
    }
  };
  metric("load_container_cpu_cores", "CPU used, in cores (docker stats)", (s) => s.cpuPct / 100);
  metric("load_container_cpu_limit_cores", "CPU limit, in cores (0 = none)", (s) => s.cpuLimitCores);
  metric("load_container_memory_bytes", "Memory used (docker stats)", (s) => s.memMiB * 1024 ** 2);
  metric("load_container_memory_limit_bytes", "Memory limit", (s) => s.memLimitMiB * 1024 ** 2);
  return `${lines.join("\n")}\n`;
}

function sampleOnce(prefix: string, cpuLimits: Record<string, number>): Sample[] {
  const result = spawnSync("docker", ["stats", "--no-stream", "--format", "{{json .}}"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`docker stats failed: ${result.stderr}`);
  const timestamp = new Date().toISOString();
  return result.stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => parseRow(line, timestamp, cpuLimits))
    .filter((sample) => sample.container.startsWith(prefix));
}

function option(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const out = option(args, "out", "docker-stats.csv");
  const intervalMs = Number(option(args, "interval", "5")) * 1000;
  const durationMs = Number(option(args, "duration", "0")) * 1000;
  const prefix = option(args, "prefix", "llm-chat-");
  const port = Number(option(args, "serve", "0"));
  let latest: Sample[] = [];
  if (port > 0) {
    createServer((_req, res) => {
      res.setHeader("Content-Type", "text/plain; version=0.0.4");
      res.end(toPrometheus(latest));
    }).listen(port);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${CSV_HEADER}\n`);
  let running = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => (running = false));

  const started = Date.now();
  let samples = 0;
  while (running && (durationMs === 0 || Date.now() - started < durationMs)) {
    const tick = Date.now();
    const rows = sampleOnce(prefix, readCpuLimits());
    latest = rows;
    appendFileSync(out, rows.map((row) => `${toCsvLine(row)}\n`).join(""));
    samples += 1;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, intervalMs - (Date.now() - tick))));
  }
  console.log(`${samples} samples written to ${out}`);
  process.exit(0);
}

if (import.meta.main) {
  await main();
}
