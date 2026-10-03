import { describe, expect, it } from "vitest";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { ApiError } from "../../../shared/api-client";
import { loginUser, logoutUser } from "./login";

describe("loginUser", () => {
  it("POSTs the credentials as JSON with cookies and resolves with the public profile", async () => {
    const requests = recordRequests();

    await expect(loginUser({ email: "ana@example.com", password: "pw" })).resolves.toMatchObject({
      email: "ana@example.com",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe("POST");
    expect(new URL(requests[0]!.url).pathname).toBe("/auth/login");
    expect(requests[0]!.credentials).toBe("include");
    expect(await requests[0]!.json()).toEqual({ email: "ana@example.com", password: "pw" });
  });

  it("AC-36: rejects with the server's single generic message on bad credentials", async () => {
    server.use(http.post("*/auth/login", () => HttpResponse.json({ error: "Invalid credentials" }, { status: 401 })));

    const failure = loginUser({ email: "ana@example.com", password: "wrong" });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 401, message: "Invalid credentials" });
  });
});

describe("logoutUser", () => {
  it("POSTs to /auth/logout and resolves with nothing on 204", async () => {
    const requests = recordRequests();

    await expect(logoutUser()).resolves.toBeUndefined();

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/logout"]);
  });

  it("rejects when the server fails", async () => {
    server.use(http.post("*/auth/logout", () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    await expect(logoutUser()).rejects.toMatchObject({ status: 500, message: "boom" });
  });
});
