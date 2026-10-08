import assert from "node:assert/strict";
import { test } from "node:test";
import { type Observation, evaluate } from "./postgres-down.ts";

const up = { status: "running", restartCount: 0, startedAt: "t0" };
const good = (): Observation => ({
  before: { a: up, b: up },
  after: { a: up, b: up },
  outage: { a: [{ status: 503, ms: 20 }], b: [{ status: 503, ms: 30 }] },
  recoveryS: 12,
});
const failing = (o: Observation) => evaluate(o).filter((c) => !c.ok).map((c) => c.name);

test("passes when nothing crashed, errors are 503 and recovery is under 60 s", () => {
  assert.deepEqual(failing(good()), []);
});

test("fails when a container restarted", () => {
  const o = good();
  o.after.a = { ...up, restartCount: 1, startedAt: "t1" };
  assert.deepEqual(failing(o), ["crash:a"]);
});

test("fails when a container is not running", () => {
  const o = good();
  o.after.b = { ...up, status: "exited" };
  assert.deepEqual(failing(o), ["crash:b"]);
});

test("fails on a 200, a refused connection or a slow error during the outage", () => {
  const o = good();
  o.outage.a = [{ status: 200, ms: 5 }];
  o.outage.b = [{ status: 0, ms: 5000 }];
  assert.deepEqual(failing(o), ["errors:a", "errors:b"]);
  o.outage.a = [{ status: 503, ms: 9000 }];
  assert.ok(failing(o).includes("errors:a"));
});

test("fails when recovery takes 60 s or never happens", () => {
  const o = good();
  o.recoveryS = 60;
  assert.deepEqual(failing(o), ["recovery"]);
  o.recoveryS = null;
  assert.deepEqual(failing(o), ["recovery"]);
});
