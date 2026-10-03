import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { captureRouteTemplate } from "./http-metrics.js";

describe("captureRouteTemplate", () => {
  it("joins the router mount and the matched path, snapshotted when the route is assigned", () => {
    const req = { baseUrl: "/auth" } as Request;
    const template = captureRouteTemplate(req);

    (req as { route: unknown }).route = { path: "/login" };
    req.baseUrl = "";

    expect(template()).toBe("/auth/login");
  });

  it("uses the matched path for app-level routes", () => {
    const req = { baseUrl: "" } as Request;
    const template = captureRouteTemplate(req);

    (req as { route: unknown }).route = { path: "/health" };

    expect(template()).toBe("/health");
  });

  it('returns "unmatched" when no route was matched', () => {
    expect(captureRouteTemplate({ baseUrl: "" } as Request)()).toBe("unmatched");
  });
});
