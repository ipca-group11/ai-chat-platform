import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { useLogout } from "./useLogout";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

describe("useLogout", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("revokes the session, clears the whole query cache and redirects to /login", async () => {
    const requests = recordRequests();
    const { result, queryClient } = renderHookWithClient(() => useLogout());
    queryClient.setQueryData(["chats"], [{ id: "c1" }]);

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/logout"]);
    expect(queryClient.getQueryData(["chats"])).toBeUndefined();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
  });

  it("still clears the cache and redirects when the server fails (500), and reports the error", async () => {
    server.use(http.post("*/auth/logout", () => HttpResponse.json({ error: "Server error" }, { status: 500 })));
    const { result, queryClient } = renderHookWithClient(() => useLogout());
    queryClient.setQueryData(["chats"], [{ id: "c1" }]);

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 500 });
    expect(queryClient.getQueryData(["chats"])).toBeUndefined();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
  });

  it("still redirects when the logout request is rejected as unauthorized (401: session already expired)", async () => {
    server.use(http.post("*/auth/logout", () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })));
    const { result } = renderHookWithClient(() => useLogout());

    result.current.mutate();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(result.current.isError).toBe(true);
  });
});
