import type { Request, Response } from "express";
import { vi } from "vitest";

export interface FakeRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

/** A chainable `res` that records `status`, `json` and `send`, for controller unit tests. */
export function fakeRes(): FakeRes & Response {
  const res = {} as FakeRes;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res as FakeRes & Response;
}

export function fakeReq(parts: {
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  file?: unknown;
  userId?: string;
  userEmail?: string;
} = {}): Request {
  const headers = Object.fromEntries(Object.entries(parts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    params: parts.params ?? {},
    body: parts.body ?? {},
    file: parts.file,
    userId: parts.userId ?? "user-1",
    userEmail: parts.userEmail ?? "ana@example.com",
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}
