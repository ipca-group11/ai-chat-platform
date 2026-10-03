import { screen } from "@testing-library/react";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { CurrentUserProvider } from "./auth-context";
import { ChatListPage } from "./ChatListPage";

beforeEach(() => {
  installFakeEventSource();
  window.localStorage.clear();
});

function renderPage() {
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: "/chats", component: ChatListPage });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/chats"] }),
  });
  return renderWithClient(
    <CurrentUserProvider userId="user-1">
      <RouterProvider router={router} />
    </CurrentUserProvider>
  );
}

describe("ChatListPage", () => {
  it("shows the signed-in user's chats with no chat open", async () => {
    server.use(
      http.get("*/chats", () =>
        HttpResponse.json({
          chats: [
            {
              id: "chat-1",
              title: "Trip planning",
              ownerId: "user-1",
              provider: "anthropic",
              model: "claude-haiku-4-5",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        })
      )
    );

    renderPage();

    expect(await screen.findByText("Trip planning")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select a chat" })).toBeInTheDocument();
  });

  it("explains the empty state when there are no chats", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [] })));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Select a chat" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Chats" })).not.toBeInTheDocument();
  });
});
