import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithClient, withQueryClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { CurrentUserGate, CurrentUserProvider, useCurrentUserId } from "./auth-context";

function ShowUser() {
  return <p>Signed in as {useCurrentUserId()}</p>;
}

describe("useCurrentUserId", () => {
  it("returns the id given to the provider", () => {
    const { result } = renderHook(() => useCurrentUserId(), {
      wrapper: ({ children }) => <CurrentUserProvider userId="user-7">{children}</CurrentUserProvider>,
    });

    expect(result.current).toBe("user-7");
  });

  it("fails with a clear message outside a provider", () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => renderHook(() => useCurrentUserId())).toThrow(/within a CurrentUserProvider/);
    } finally {
      console.error = quiet;
    }
  });
});

describe("CurrentUserGate", () => {
  it("reuses a user id provided higher up and does not call /auth/me", () => {
    const requests = recordRequests();

    render(
      <CurrentUserProvider userId="user-1">
        <CurrentUserGate>
          <ShowUser />
        </CurrentUserGate>
      </CurrentUserProvider>,
      { wrapper: withQueryClient() }
    );

    expect(screen.getByText("Signed in as user-1")).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("shows a loading skeleton, then the children once the session resolves", async () => {
    server.use(http.get("*/auth/me", () => HttpResponse.json({ id: "user-9", email: "n@example.test" })));

    const { container } = renderWithClient(
      <CurrentUserGate>
        <ShowUser />
      </CurrentUserGate>
    );

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("flex");
    expect(await screen.findByText("Signed in as user-9")).toBeInTheDocument();
  });

  it("asks the user to sign in again when the session cannot be verified", async () => {
    server.use(http.get("*/auth/me", () => new HttpResponse(null, { status: 401 })));

    renderWithClient(
      <CurrentUserGate>
        <ShowUser />
      </CurrentUserGate>
    );

    expect(await screen.findByText("Your session could not be verified. Please sign in again.")).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("does not retry a rejected session", async () => {
    const requests = recordRequests();
    server.use(http.get("*/auth/me", () => new HttpResponse(null, { status: 401 })));

    renderWithClient(
      <CurrentUserGate>
        <ShowUser />
      </CurrentUserGate>
    );
    await screen.findByText(/session could not be verified/);

    expect(requests).toHaveLength(1);
  });
});
