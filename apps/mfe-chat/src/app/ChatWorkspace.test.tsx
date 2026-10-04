import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import type { Chat } from "../shared/types";
import { CurrentUserProvider } from "./auth-context";
import { ChatDetailPage } from "./ChatDetailPage";
import { ChatListPage } from "./ChatListPage";

const chat = (id: string, title: string): Chat => ({
  id,
  title,
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const first = chat("chat-1", "First chat");
const second = chat("chat-2", "Second chat");

function useChats(chats: Chat[]) {
  server.use(
    http.get("*/chats", () => HttpResponse.json({ chats })),
    http.get("*/chats/:chatId", ({ params }) => HttpResponse.json({ chat: chats.find((c) => c.id === params.chatId) })),
    http.get("*/chats/:chatId/messages", () => HttpResponse.json({ messages: [] })),
    http.delete("*/chats/:chatId", () => new HttpResponse(null, { status: 204 }))
  );
}

/** The workspace on `/chats` and `/chats/$chatId`, mounted by the remote's two pages. */
function renderWorkspace(path: string) {
  const root = createRootRoute();
  const list = createRoute({ getParentRoute: () => root, path: "/chats", component: ChatListPage });
  const detail = createRoute({ getParentRoute: () => root, path: "/chats/$chatId", component: ChatDetailPage });
  const router = createRouter({
    routeTree: root.addChildren([list, detail]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = renderWithClient(
    <CurrentUserProvider userId="user-1">
      <RouterProvider router={router} />
    </CurrentUserProvider>
  );
  return { ...view, router };
}

function setViewport(wide: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: wide,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("ChatWorkspace (through ChatListPage and ChatDetailPage)", () => {
  beforeEach(() => {
    installFakeEventSource();
    window.localStorage.clear();
    setViewport(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the chat list and a prompt to pick a chat when none is open", async () => {
    useChats([first, second]);

    renderWorkspace("/chats");

    const nav = await screen.findByRole("navigation", { name: "Chats" });
    expect(await within(nav).findByText("First chat")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select a chat" })).toBeInTheDocument();
    expect(screen.queryByTestId("chat-pane-chat-1")).not.toBeInTheDocument();
  });

  it("opens the chat from the URL in a pane", async () => {
    useChats([first, second]);

    renderWorkspace("/chats/chat-1");

    expect(await screen.findByRole("region", { name: "First chat" })).toBeInTheDocument();
    expect(screen.getByTestId("chat-pane-chat-1")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select a chat" })).not.toBeInTheDocument();
    // A single pane has no split toolbar and no close button.
    expect(screen.queryByText(/chats open/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close pane" })).not.toBeInTheDocument();
  });

  it("navigates to the chat that is picked in the list", async () => {
    useChats([first, second]);
    const { router } = renderWorkspace("/chats");

    await userEvent.click(await screen.findByText("Second chat"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/chats/chat-2"));
    expect(await screen.findByRole("region", { name: "Second chat" })).toBeInTheDocument();
  });

  it("swaps the picked chat into the focused pane instead of adding one", async () => {
    useChats([first, second]);
    renderWorkspace("/chats/chat-1");

    await userEvent.click(await screen.findByText("Second chat"));

    expect(await screen.findByTestId("chat-pane-chat-2")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-pane-chat-1")).not.toBeInTheDocument();
  });

  it("splits beside the focused chat, announces the count, and flips the orientation", async () => {
    useChats([first, second]);
    renderWorkspace("/chats/chat-1");

    await userEvent.click(await screen.findByLabelText("Open Second chat to the right"));

    expect(await screen.findByText("2 chats open")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Layout of the focused chat's group" });
    expect(within(group).getByRole("button", { name: "Side by side" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("chat-pane-chat-2")).toHaveAttribute("data-focused", "true");
    expect(screen.getByTestId("chat-pane-chat-1")).not.toHaveAttribute("data-focused");

    await userEvent.click(within(group).getByRole("button", { name: "Stacked" }));

    expect(within(group).getByRole("button", { name: "Stacked" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("chat-pane-chat-2").style.top).toBe("50%");
  });

  it("moves focus to a pane when the user interacts with it, but not through its close button", async () => {
    useChats([first, second]);
    const { router } = renderWorkspace("/chats/chat-1");
    await userEvent.click(await screen.findByLabelText("Open Second chat to the right"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/chats/chat-2"));

    await userEvent.click(within(screen.getByTestId("chat-pane-chat-1")).getByLabelText("Message"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/chats/chat-1"));
    expect(screen.getByTestId("chat-pane-chat-1")).toHaveAttribute("data-focused", "true");

    // Closing the other pane must not first move the focus onto it.
    await userEvent.click(within(screen.getByTestId("chat-pane-chat-2")).getByRole("button", { name: "Close pane" }));

    expect(screen.queryByTestId("chat-pane-chat-2")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/chats/chat-1");
  });

  it("closes the pane of a chat that gets deleted from the list", async () => {
    useChats([first, second]);
    const { router } = renderWorkspace("/chats/chat-1");
    await userEvent.click(await screen.findByLabelText("Open Second chat to the right"));
    expect(await screen.findByTestId("chat-pane-chat-2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete Second chat" }));

    await waitFor(() => expect(screen.queryByTestId("chat-pane-chat-2")).not.toBeInTheDocument());
    expect(screen.getByTestId("chat-pane-chat-1")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/chats/chat-1"));
  });

  it("goes back to the list from a chat on a small screen", async () => {
    setViewport(false);
    useChats([first]);
    const { router } = renderWorkspace("/chats/chat-1");

    await userEvent.click(await screen.findByRole("button", { name: "Back to chats" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/chats"));
    expect(await screen.findByRole("heading", { name: "Select a chat" })).toBeInTheDocument();
  });

  it("does not position panes absolutely on a small screen", async () => {
    setViewport(false);
    useChats([first]);

    renderWorkspace("/chats/chat-1");

    const pane = await screen.findByTestId("chat-pane-chat-1");
    expect(pane.getAttribute("style")).toBeNull();
  });
});
