import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { jsonResponse } from "../test/utils";
import type { Chat, Message } from "../shared/types";
import { CurrentUserProvider } from "./auth-context";
import { createChatRoutes } from "./routes";

const chat: Chat = {
  id: "chat-1",
  title: "My chat",
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const messages: Message[] = [];

function renderChatRoutes(initialPath: string) {
  const rootRoute = createRootRoute();
  const routes = createChatRoutes(rootRoute);
  const routeTree = rootRoute.addChildren(routes);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return renderWithClient(
    <CurrentUserProvider userId="user-1">
      <RouterProvider router={router} />
    </CurrentUserProvider>);
}

describe("createChatRoutes (FE-1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installFakeEventSource();
    window.localStorage.clear();
  });

  it("registers /chats and renders the chat list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([chat])));

    renderChatRoutes("/chats");

    expect(await screen.findByText("My chat")).toBeInTheDocument();
  });

  it("registers /chats/:chatId and navigates from the list into the chat view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/messages")) return Promise.resolve(jsonResponse(messages));
        if (url.endsWith(`/chats/${chat.id}`)) return Promise.resolve(jsonResponse(chat));
        return Promise.resolve(jsonResponse([chat]));
      })
    );

    renderChatRoutes("/chats");

    await userEvent.click(await screen.findByText("My chat"));

    expect(await screen.findByLabelText("Message")).toBeInTheDocument();
  });

  it("opens chats side by side and stacked in the same layout, flips a group, and closes panes", async () => {
    const second: Chat = { ...chat, id: "chat-2", title: "Second chat" };
    const third: Chat = { ...chat, id: "chat-3", title: "Third chat" };
    const all = [chat, second, third];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/messages")) return Promise.resolve(jsonResponse(messages));
        const found = all.find((c) => url.endsWith(`/chats/${c.id}`));
        return Promise.resolve(jsonResponse(found ?? all));
      })
    );

    renderChatRoutes(`/chats/${chat.id}`);

    // Second opens right of the first; third opens below the second: [1 | (2 / 3)].
    await userEvent.click(await screen.findByLabelText("Open Second chat to the right"));
    await userEvent.click(await screen.findByLabelText("Open Third chat below"));

    expect(await screen.findAllByLabelText("Message")).toHaveLength(3);
    expect(screen.getByTestId("chat-pane-chat-3")).toHaveAttribute("data-focused", "true");
    expect(screen.getByRole("button", { name: "Stacked" })).toHaveAttribute("aria-pressed", "true");
    const paneBox = (id: string) => {
      const style = screen.getByTestId(`chat-pane-${id}`).style;
      return [style.top, style.left, style.width, style.height];
    };
    expect(paneBox("chat-1")).toEqual(["0%", "0%", "50%", "100%"]);
    expect(paneBox("chat-2")).toEqual(["0%", "50%", "50%", "50%"]);
    expect(paneBox("chat-3")).toEqual(["50%", "50%", "50%", "50%"]);

    // Flipping the focused group puts all three side by side.
    await userEvent.click(screen.getByRole("button", { name: "Side by side" }));
    expect(screen.getByRole("button", { name: "Side by side" })).toHaveAttribute("aria-pressed", "true");
    expect(paneBox("chat-3")[0]).toBe("0%");

    // Closing an unfocused pane keeps focus where it was.
    const firstPane = screen.getByTestId("chat-pane-chat-1");
    await userEvent.click(within(firstPane).getByRole("button", { name: "Close pane" }));

    expect(screen.queryByTestId("chat-pane-chat-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-pane-chat-3")).toHaveAttribute("data-focused", "true");

    // Closing the focused pane hands focus to its neighbour.
    await userEvent.click(within(screen.getByTestId("chat-pane-chat-3")).getByRole("button", { name: "Close pane" }));

    expect(await screen.findByTestId("chat-pane-chat-2")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-pane-chat-3")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close pane" })).not.toBeInTheDocument();
  });
});
