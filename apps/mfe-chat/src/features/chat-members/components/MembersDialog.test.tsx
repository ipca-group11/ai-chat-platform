import { configure, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import type { ChatMember } from "../../../shared/types";
import { MembersDialog } from "./MembersDialog";

// Every findBy/waitFor here waits for an MSW response. The default 1s was not enough when nx ran
// several projects in parallel; a longer limit costs nothing when the response arrives quickly.
configure({ asyncUtilTimeout: 5000 });

const owner: ChatMember = { email: "owner@example.com", role: "owner", addedAt: "2026-01-01T00:00:00.000Z" };
const guest: ChatMember = { email: "guest@example.com", role: "member", addedAt: "2026-01-02T00:00:00.000Z" };

function renderDialog(props: Partial<Parameters<typeof MembersDialog>[0]> = {}) {
  return renderWithClient(
    <MembersDialog chatId="chat-1" chatTitle="Trip" isOwner open onClose={vi.fn()} {...props} />);
}

const listMembers = (members: ChatMember[]) =>
  server.use(http.get("*/chats/:chatId/members", () => HttpResponse.json({ members })));
const seen = (requests: Request[], method: string) => requests.find((r) => r.method === method);

describe("MembersDialog", () => {
  it("lists the owner and members", async () => {
    listMembers([owner, guest]);

    renderDialog();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("guest@example.com")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("is named once, by its title", async () => {
    listMembers([owner]);

    renderDialog();

    const dialog = await screen.findByRole("dialog", { name: "Members" });
    expect(dialog).not.toHaveAttribute("aria-label");
    expect(dialog).toHaveAttribute("aria-labelledby", screen.getByRole("heading", { name: "Members" }).id);
  });

  it("the owner invites someone by email", async () => {
    listMembers([owner]);
    server.use(http.post("*/chats/:chatId/members", () => HttpResponse.json({ member: guest }, { status: 201 })));
    const requests = recordRequests();

    renderDialog();
    await screen.findByText("owner@example.com");
    await userEvent.type(screen.getByLabelText("Invite by email"), "guest@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(await screen.findByText("guest@example.com")).toBeInTheDocument();
    const post = seen(requests, "POST");
    expect(new URL(post!.url).pathname).toBe("/api/chats/chat-1/members");
    expect(await post!.json()).toEqual({ email: "guest@example.com" });
  });

  it("shows the server error when an invite is rejected", async () => {
    listMembers([owner, guest]);
    server.use(
      http.post("*/chats/:chatId/members", () =>
        HttpResponse.json(
          { code: "ALREADY_A_MEMBER", message: "That user is already a member of this chat" },
          { status: 409 }
        )
      )
    );

    renderDialog();
    await screen.findByText("guest@example.com");
    await userEvent.type(screen.getByLabelText("Invite by email"), "guest@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(await screen.findByText("That user is already a member of this chat")).toBeInTheDocument();
  });

  it("the owner removes a member", async () => {
    listMembers([owner, guest]);
    server.use(http.delete("*/chats/:chatId/members/:email", () => new HttpResponse(null, { status: 204 })));
    const requests = recordRequests();

    renderDialog();
    await userEvent.click(await screen.findByLabelText("Remove guest@example.com"));

    await waitFor(() => expect(screen.queryByText("guest@example.com")).not.toBeInTheDocument());
    expect(new URL(seen(requests, "DELETE")!.url).pathname).toBe(
      `/api/chats/chat-1/members/${encodeURIComponent("guest@example.com")}`
    );
  });

  it("a member sees no invite form or remove buttons, and can leave", async () => {
    const onLeft = vi.fn();
    listMembers([owner, guest]);
    server.use(http.delete("*/chats/:chatId/membership", () => new HttpResponse(null, { status: 204 })));
    const requests = recordRequests();

    renderDialog({ isOwner: false, onLeft });
    await screen.findByText("guest@example.com");

    expect(screen.queryByLabelText("Invite by email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove guest@example.com")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Leave chat" }));

    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(new URL(seen(requests, "DELETE")!.url).pathname).toBe("/api/chats/chat-1/membership");
  });
});
