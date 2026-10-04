import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { describe, expect, it } from "vitest";
import { AuthError, fetchCurrentUser } from "./auth";

describe("fetchCurrentUser", () => {
  it("AC-78: calls GET /auth/me with credentials included so the session cookie is sent", async () => {
    const requests = recordRequests();

    await fetchCurrentUser();

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["GET /auth/me"]);
    expect(requests[0]!.credentials).toBe("include");
  });

  it("AC-78: resolves with the current user id and email", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ id: "user-1", email: "a@b.com" })));

    const user = await fetchCurrentUser();

    expect(user).toEqual({ id: "user-1", email: "a@b.com" });
  });

  it("throws an AuthError with the response status when unauthenticated", async () => {
    server.use(http.get("*/auth/me", () => new HttpResponse(null, { status: 401, statusText: "Unauthorized" })));

    await expect(fetchCurrentUser()).rejects.toThrow(AuthError);
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 401 });
  });
});
