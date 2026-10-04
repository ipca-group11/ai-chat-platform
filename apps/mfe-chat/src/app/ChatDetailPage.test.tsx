import { screen } from "@testing-library/react";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { CurrentUserProvider } from "./auth-context";
import { ChatDetailPage } from "./ChatDetailPage";

beforeEach(() => {
  installFakeEventSource();
  window.localStorage.clear();
});

function renderPage(path: string) {
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: "/chats/$chatId", component: ChatDetailPage });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return renderWithClient(
    <CurrentUserProvider userId="user-1">
      <RouterProvider router={router} />
    </CurrentUserProvider>
  );
}

describe("ChatDetailPage", () => {
  it("opens the chat named in the URL", async () => {
    server.use(
      http.get("*/chats/:chatId", ({ params }) =>
        HttpResponse.json({
          chat: {
            id: params.chatId,
            title: `Chat ${String(params.chatId)}`,
            ownerId: "user-1",
            provider: "anthropic",
            model: "claude-3-5-haiku-latest",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        })
      )
    );

    renderPage("/chats/abc");

    // The chat view is a lazy chunk (AICHAT-239); its first transform in the test run can take a moment.
    expect(await screen.findByRole("region", { name: "Chat abc" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("chat-pane-abc")).toBeInTheDocument();
  });
});
