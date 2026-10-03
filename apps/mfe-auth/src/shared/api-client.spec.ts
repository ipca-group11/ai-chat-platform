import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { describe, expect, it } from "vitest";
import { apiFetch, ApiError } from "./api-client";
import { CORRELATION_HEADER } from "./correlation";

describe("apiFetch", () => {
  it("always sends credentials: include so httpOnly cookies are attached", async () => {
    const requests = recordRequests();

    await apiFetch("/auth/me");

    expect(requests).toHaveLength(1);
    expect(requests[0]!.credentials).toBe("include");
  });

  it("injects a correlation id header when the caller didn't set one", async () => {
    const requests = recordRequests();

    await apiFetch("/auth/me");

    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toBeTruthy();
  });

  it("preserves a caller-supplied correlation id instead of overwriting it", async () => {
    const requests = recordRequests();

    await apiFetch("/auth/me", { headers: { [CORRELATION_HEADER]: "given-id" } });

    expect(requests[0]!.headers.get(CORRELATION_HEADER)).toBe("given-id");
  });

  it("throws an ApiError with the server's message on a non-2xx response", async () => {
    server.use(
      http.post("*/auth/login", () => HttpResponse.json({ error: "Invalid email or password" }, { status: 401 })),
    );

    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("resolves with parsed JSON on success", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ id: "1", email: "a@b.com" })));

    await expect(apiFetch("/auth/me")).resolves.toEqual({ id: "1", email: "a@b.com" });
  });
});
