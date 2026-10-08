import express, { type RequestHandler } from "express";

/** Set on the request when its body was not valid JSON; each router answers with its own error shape. */
export const BODY_ERROR = Symbol("mock.bodyError");
type WithBodyError = { [BODY_ERROR]?: unknown };

/**
 * Body parser for the routers. The request log has already read the body; when that failed, the
 * parse error is passed on from here so the router's own error handler formats it.
 */
export const jsonBody = (limit = "5mb"): RequestHandler => {
  const parse = express.json({ limit });
  return (req, res, next) => {
    const error = (req as WithBodyError)[BODY_ERROR];
    if (error) next(error);
    else parse(req, res, next);
  };
};

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
  /** When the whole answer was sent; null while it is still streaming or if the client left. */
  finishedAt: string | null;
  /** When the client closed the connection before the answer was complete (a stopped stream,
   * AICHAT-201); null when the answer finished. */
  clientClosedAt: string | null;
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
          // Lenient: log the request without a body and let the router answer in its own shape.
          (req as WithBodyError)[BODY_ERROR] = err;
          req.body = undefined;
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
          finishedAt: null,
          clientClosedAt: null,
        };
        entries.push(entry);
        if (entries.length > capacity) entries = entries.slice(-capacity);
        res.on("finish", () => {
          entry.status = res.statusCode;
          entry.finishedAt = new Date().toISOString();
        });
        // `close` also follows a normal finish; only a close before it means the client left.
        res.on("close", () => {
          if (!res.writableFinished) entry.clientClosedAt = new Date().toISOString();
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
