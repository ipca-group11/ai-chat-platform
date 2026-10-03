import { describe, expect, it } from "vitest";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { fetchCurrentUser } from "./auth";
import { CORRELATION_HEADER } from "./types";

describe("fetchCurrentUser", () => {
  it("returns the user when auth-service sends it directly", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ id: "u1", email: "a@example.test" })));

    await expect(fetchCurrentUser()).resolves.toEqual({ id: "u1", email: "a@example.test" });
  });

  it("returns the user when auth-service wraps it in { user }", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ user: { id: "u2", email: "b@example.test" } })));

    await expect(fetchCurrentUser()).resolves.toEqual({ id: "u2", email: "b@example.test" });
  });

  it("sends the session cookie and a correlation id to /auth/me", async () => {
    const requests = recordRequests();

    await fetchCurrentUser();

    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe("/auth/me");
    expect(requests[0]!.credentials).toBe("include");
    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects with the status when there is no valid session", async () => {
    server.use(http.get("*/auth/me", () => new HttpResponse(null, { status: 401 })));

    await expect(fetchCurrentUser()).rejects.toThrow("GET /auth/me failed with 401");
  });

  it("rejects when the service cannot be reached", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.error()));

    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(TypeError);
  });
});
