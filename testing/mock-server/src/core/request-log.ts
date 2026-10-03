import express, { type RequestHandler } from "express";

export const MASK = "***";

/** Headers whose value is never stored. */
const SENSITIVE_HEADERS = new Set(["authorization", "x-api-key", "x-llm-api-key", "cookie", "set-cookie", "proxy-authorization"]);
/** Body fields (any depth) whose name looks like a secret. */
const SENSITIVE_FIELD = /key|token|password|secret/i;

export interface LoggedRequest {
  id: number;
  at: string;
  /** Name of the mock that received the request. */
  mock: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  status: number | null;
}

export interface RequestLog {
  /** Records the requests that reach the mock called `mock`. */
  middleware(mock: string): RequestHandler;
  list(filter?: { mock?: string }): LoggedRequest[];
  clear(): void;
}

export function maskHeaders(headers: Record<string, string | string[] | undefined>): LoggedRequest["headers"] {
  const out: LoggedRequest["headers"] = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? MASK : value;
  }
  return out;
}

export function maskValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_FIELD.test(k) ? MASK : maskValue(v)]),
    );
  }
  return value;
}

/**
 * In-memory log of the requests the mocks receive, for `/__admin/requests`.
 * Keeps the newest `capacity` entries; secrets are masked before they are stored.
 */
export function createRequestLog(capacity = 1000): RequestLog {
  let entries: LoggedRequest[] = [];
  let nextId = 1;
  const json = express.json({ limit: "5mb" });

  return {
    middleware: (mock) => (req, res, next) => {
      json(req, res, (err?: unknown) => {
        if (err) {
          res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
          return;
        }
        const entry: LoggedRequest = {
          id: nextId++,
          at: new Date().toISOString(),
          mock,
          method: req.method,
          path: req.originalUrl.split("?")[0] ?? req.originalUrl,
          query: maskValue(req.query) as Record<string, unknown>,
          headers: maskHeaders(req.headers),
          body: maskValue(req.body as unknown),
          status: null,
        };
        entries.push(entry);
        if (entries.length > capacity) entries = entries.slice(-capacity);
        res.on("finish", () => {
          entry.status = res.statusCode;
        });
        next();
      });
    },
    list: (filter) => (filter?.mock ? entries.filter((e) => e.mock === filter.mock) : [...entries]),
    clear() {
      entries = [];
      nextId = 1;
    },
  };
}
