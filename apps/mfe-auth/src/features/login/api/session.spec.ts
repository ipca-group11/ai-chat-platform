import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api-client";
import { fetchSessionWithRefresh } from "./session";

const paths = (requests: Request[]) => requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);
const user = { id: "1", email: "a@b.com" };
const unauthorized = () => HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Unauthorized" } }, { status: 401 });

describe("fetchSessionWithRefresh (F4 session contract)", () => {
  it("AC-41: resolves with the current user when /auth/me succeeds", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json(user)));
    const requests = recordRequests();

    await expect(fetchSessionWithRefresh()).resolves.toEqual(user);
    expect(paths(requests)).toEqual(["GET /auth/me"]);
  });

  it("AC-41: a 401 from /auth/me triggers one silent refresh, then retries /auth/me once", async () => {
    server.use(
      http.get("*/auth/me", unauthorized, { once: true }), // first GET /auth/me
      http.get("*/auth/me", () => HttpResponse.json(user)), // retry
    );
    const requests = recordRequests();

    await expect(fetchSessionWithRefresh()).resolves.toEqual(user);
    expect(paths(requests)).toEqual(["GET /auth/me", "POST /auth/refresh", "GET /auth/me"]);
  });

  it("AC-41: surfaces 'not authenticated' (a 401 ApiError) if the refresh retry also fails, without retrying again", async () => {
    server.use(http.get("*/auth/me", unauthorized)); // refresh succeeds with the default handler
    const requests = recordRequests();

    const failure = fetchSessionWithRefresh();
    await expect(failure).rejects.toMatchObject({ status: 401 });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    expect(paths(requests)).toEqual(["GET /auth/me", "POST /auth/refresh", "GET /auth/me"]);
  });

  it("AC-41: a non-401 error from /auth/me is rethrown immediately without attempting a refresh", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Server error" } }, { status: 500 })));
    const requests = recordRequests();

    await expect(fetchSessionWithRefresh()).rejects.toMatchObject({ status: 500 });
    expect(paths(requests)).toEqual(["GET /auth/me"]);
  });
});
