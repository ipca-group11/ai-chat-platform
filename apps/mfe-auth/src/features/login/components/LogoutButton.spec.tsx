import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../../shared/test/render";
import { LogoutButton } from "./LogoutButton";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LogoutButton", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-38: clicking sign out calls POST /auth/logout, clears query cache and redirects to /login", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, 204));
    const user = userEvent.setup();
    const { queryClient } = renderWithQueryClient(<LogoutButton />);
    const clearSpy = vi.spyOn(queryClient, "clear");

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(fetch).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(clearSpy).toHaveBeenCalled();
  });

  it("AC-38: redirects to /login and clears the cache even if the logout request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Server error" }, 500));
    const user = userEvent.setup();
    const { queryClient } = renderWithQueryClient(<LogoutButton />);
    const clearSpy = vi.spyOn(queryClient, "clear");

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(clearSpy).toHaveBeenCalled();
  });
});
