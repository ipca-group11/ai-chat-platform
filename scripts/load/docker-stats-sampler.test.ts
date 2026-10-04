import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CSV_HEADER, parseRow, parseSize, toCsvLine, toPrometheus } from "./docker-stats-sampler.ts";

describe("docker-stats-sampler", () => {
  it("parses docker sizes in binary and decimal units", () => {
    assert.equal(parseSize("512MiB"), 512 * 1024 ** 2);
    assert.equal(parseSize("1.5GiB"), 1.5 * 1024 ** 3);
    assert.equal(parseSize("2.5kB"), 2500);
    assert.equal(parseSize("0B"), 0);
    assert.equal(parseSize("garbage"), 0);
  });

  it("turns a docker stats row into a CSV line with the share of the limit", () => {
    const line = JSON.stringify({
      Name: "llm-chat-conversation-service-1",
      CPUPerc: "59.31%",
      MemUsage: "256MiB / 1GiB",
      NetIO: "12.5MB / 3.1MB",
      PIDs: "23",
    });
    const sample = parseRow(line, "2026-10-03T10:00:00.000Z", { "llm-chat-conversation-service-1": 0.6 });
    assert.equal(sample.memMiB, 256);
    assert.equal(sample.memLimitMiB, 1024);
    assert.equal(sample.memPct, 25);
    assert.equal(
      toCsvLine(sample),
      "2026-10-03T10:00:00.000Z,llm-chat-conversation-service-1,59.31,0.60,256.00,1024.00,25.00,12.50,3.10,23",
    );
    assert.equal(CSV_HEADER.split(",").length, toCsvLine(sample).split(",").length);
  });

  it("renders Prometheus metrics labelled with the compose service", () => {
    const sample = parseRow(
      JSON.stringify({ Name: "llm-chat-shell-1", CPUPerc: "50.00%", MemUsage: "128MiB / 512MiB", NetIO: "0B / 0B", PIDs: "9" }),
      "t",
      { "llm-chat-shell-1": 0.4 },
    );
    const text = toPrometheus([sample]);
    assert.match(text, /load_container_cpu_cores\{service="shell"\} 0.5\n/);
    assert.match(text, /load_container_cpu_limit_cores\{service="shell"\} 0.4\n/);
    assert.match(text, /load_container_memory_limit_bytes\{service="shell"\} 536870912\n/);
  });

  it("gives a share of 0 when the container has no limit it reports", () => {
    const sample = parseRow(
      JSON.stringify({ Name: "x", CPUPerc: "--", MemUsage: "10MiB / 0B", NetIO: "0B / 0B", PIDs: "0" }),
      "t",
    );
    assert.equal(sample.memPct, 0);
    assert.equal(sample.cpuPct, 0);
  });
});
