import type { RequestHandler, Response, Router } from "express";
import { z } from "zod";
import { pathOf, sendError } from "../backend/http.js";
import { sleep } from "../middleware.js";
import type { MockContext } from "../registry.js";

export const FAULT_SCENARIOS = ["session-expired", "error-500", "slow", "stream-drop"] as const;
export type FaultScenario = (typeof FAULT_SCENARIOS)[number];

export const SCENARIO_HEADER = "x-mock-scenario";
/** Delay of the `slow` fault when the fault does not set `delayMs`. */
export const SLOW_FAULT_MS = 3000;
/** Events a `stream-drop` stream delivers before the connection is cut. */
export const STREAM_DROP_AFTER_EVENTS = 3;

export const faultSchema = z.object({
  /** `METHOD /path`; `*` as method matches any method, `:name` any segment, a trailing `*` the rest. */
  route: z
    .string()
    .regex(/^(\*|GET|POST|PUT|PATCH|DELETE)\s+\/\S*$/, 'Use "METHOD /path", for example "GET /auth/me"'),
  scenario: z.enum(FAULT_SCENARIOS),
  /** Fault applies to this many requests, then clears itself; every request when absent. */
  times: z.number().int().positive().optional(),
  /** `slow` only: how long the response is held back. */
  delayMs: z.number().int().min(0).max(60_000).optional(),
});
export type Fault = z.infer<typeof faultSchema>;

/** True when `METHOD path` is covered by `pattern`. */
export function routeMatches(pattern: string, method: string, path: string): boolean {
  const [patternMethod, patternPath = "/"] = pattern.trim().split(/\s+/, 2);
  if (patternMethod !== "*" && patternMethod !== method) return false;
  const expected = patternPath.split("/").filter(Boolean);
  const actual = path.split("/").filter(Boolean);
  for (let i = 0; i < expected.length; i++) {
    const part = expected[i] as string;
    if (part === "*" && i === expected.length - 1) return true;
    if (i >= actual.length) return false;
    if (part === "*" || part.startsWith(":")) continue;
    if (part !== actual[i]) return false;
  }
  return expected.length === actual.length;
}

/** Faults set with `POST /__admin/faults`, per route. */
export class FaultStore {
  private faults: Array<Fault & { remaining?: number }> = [];

  set(fault: Fault): void {
    this.faults = this.faults.filter((existing) => existing.route !== fault.route);
    this.faults.push({ ...fault, remaining: fault.times });
  }

  list(): Fault[] {
    return this.faults.map(({ remaining, ...fault }) => ({
      ...fault,
      ...(remaining !== undefined ? { times: remaining } : {}),
    }));
  }

  /** Clears one route, or every fault when no route is given. Returns how many were removed. */
  clear(route?: string): number {
    const before = this.faults.length;
    this.faults = route === undefined ? [] : this.faults.filter((fault) => fault.route !== route);
    return before - this.faults.length;
  }

  /** The fault for this request, counting it against `times`. */
  take(method: string, path: string): Fault | undefined {
    const found = this.faults.find((fault) => routeMatches(fault.route, method, path));
    if (!found) return undefined;
    if (found.remaining !== undefined) {
      found.remaining -= 1;
      if (found.remaining <= 0) this.faults = this.faults.filter((fault) => fault !== found);
    }
    const { remaining: _remaining, ...fault } = found;
    return fault;
  }
}

const registry = new WeakMap<MockContext, FaultStore>();

/** The faults of one mock server; cleared by `/__admin/reset`. */
export function faultsFor(ctx: MockContext): FaultStore {
  let store = registry.get(ctx);
  if (!store) {
    const created = new FaultStore();
    ctx.onReset(() => created.clear());
    registry.set(ctx, created);
    store = created;
  }
  return store;
}

export interface FaultOptions {
  /** Message of the real service's 401 for a missing session. */
  unauthenticated: string;
  /** Message of the real service's 500. */
  internal: string;
  /** Runs before the 401 of `session-expired` (the auth mock clears its cookies). */
  onSessionExpired?: (res: Response) => void;
}

/**
 * Applies the fault of a request before the routes run. `X-Mock-Scenario` wins for one request;
 * otherwise the fault set for the route is used. A header value that is not a fault name is ignored.
 * `stream-drop` is left in `res.locals.fault` for the stream route to apply.
 */
export function faultInjector(ctx: MockContext, options: FaultOptions): RequestHandler {
  const store = faultsFor(ctx);
  return async (req, res, next) => {
    try {
      const header = req.headers[SCENARIO_HEADER];
      const named = (Array.isArray(header) ? header[0] : header)?.trim();
      const fromHeader = FAULT_SCENARIOS.find((scenario) => scenario === named);
      const fault: Fault | undefined = fromHeader
        ? { route: `${req.method} ${pathOf(req)}`, scenario: fromHeader }
        : store.take(req.method, pathOf(req));
      if (!fault) return next();

      res.setHeader("X-Mock-Fault", fault.scenario);
      switch (fault.scenario) {
        case "session-expired":
          options.onSessionExpired?.(res);
          return sendError(req, res, 401, "UNAUTHENTICATED", options.unauthenticated);
        case "error-500":
          return sendError(req, res, 500, "INTERNAL_ERROR", options.internal);
        case "slow":
          await sleep(fault.delayMs ?? SLOW_FAULT_MS);
          return next();
        case "stream-drop":
          res.locals.fault = fault;
          return next();
      }
    } catch (error) {
      next(error);
    }
  };
}

/** `GET|POST|DELETE /__admin/faults`. */
export function registerFaultRoutes(router: Router, ctx: MockContext): void {
  const store = faultsFor(ctx);

  router.get("/faults", (_req, res) => {
    res.json({ faults: store.list(), scenarios: FAULT_SCENARIOS });
  });

  router.post("/faults", (req, res) => {
    const parsed = faultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "invalid_fault",
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
            .join("; "),
          available: FAULT_SCENARIOS,
        },
      });
      return;
    }
    store.set(parsed.data);
    res.status(201).json({ faults: store.list() });
  });

  router.delete("/faults", (req, res) => {
    const route = typeof req.query.route === "string" ? req.query.route : undefined;
    const removed = store.clear(route);
    res.json({ removed, faults: store.list() });
  });
}
