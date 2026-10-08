import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { LogoutButton } from "./LogoutButton";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("AC-38: clicking sign out calls POST /auth/logout, clears query cache and redirects to /login", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<LogoutButton />);
    const clearSpy = vi.spyOn(queryClient, "clear");

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /auth/logout"]);
    expect(requests[0]!.credentials).toBe("include");
    expect(clearSpy).toHaveBeenCalled();
  });

  it("AC-38: redirects to /login and clears the cache even if the logout request fails", async () => {
    server.use(http.post("*/auth/logout", () => HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Server error" } }, { status: 500 })));
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<LogoutButton />);
    const clearSpy = vi.spyOn(queryClient, "clear");

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(clearSpy).toHaveBeenCalled();
  });
});
