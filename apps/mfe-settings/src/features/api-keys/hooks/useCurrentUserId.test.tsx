import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCurrentUserId } from "./useCurrentUserId";

describe("useCurrentUserId", () => {
  it("AC-78: resolves the current user's id from GET /auth/me", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ id: "user-42", email: "a@b.com" })));

    const { result } = renderHookWithClient(() => useCurrentUserId());

    await waitFor(() => expect(result.current.userId).toBe("user-42"));
  });

  it("reports isError without a userId when the session lookup fails", async () => {
    server.use(http.get("*/auth/me", () => new HttpResponse(null, { status: 401 })));

    const { result } = renderHookWithClient(() => useCurrentUserId());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.userId).toBeUndefined();
  });
});
