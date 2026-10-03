import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { jsonResponse } from "../../../test/utils";
import type { ChatMember } from "../../../shared/types";
import { MembersDialog } from "./MembersDialog";

const owner: ChatMember = { email: "owner@example.com", role: "owner", addedAt: "2026-01-01T00:00:00.000Z" };
const guest: ChatMember = { email: "guest@example.com", role: "member", addedAt: "2026-01-02T00:00:00.000Z" };

function renderDialog(props: Partial<Parameters<typeof MembersDialog>[0]> = {}) {
  return renderWithClient(
    <MembersDialog chatId="chat-1" chatTitle="Trip" isOwner open onClose={vi.fn()} {...props} />);
}

describe("MembersDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the owner and members", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ members: [owner, guest] }))));

    renderDialog();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("guest@example.com")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("the owner invites someone by email", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST" ? jsonResponse({ member: guest }, 201) : jsonResponse({ members: [owner] })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();
    await screen.findByText("owner@example.com");
    await userEvent.type(screen.getByLabelText("Invite by email"), "guest@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(await screen.findByText("guest@example.com")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toContain("/chats/chat-1/members");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ email: "guest@example.com" });
  });

  it("shows the server error when an invite is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === "POST"
            ? jsonResponse({ code: "ALREADY_A_MEMBER", message: "That user is already a member of this chat" }, 409)
            : jsonResponse({ members: [owner, guest] })
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
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse({ members: [owner, guest] })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();
    await userEvent.click(await screen.findByLabelText("Remove guest@example.com"));

    await waitFor(() => expect(screen.queryByText("guest@example.com")).not.toBeInTheDocument());
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(del?.[0]).toContain(`/chats/chat-1/members/${encodeURIComponent("guest@example.com")}`);
  });

  it("a member sees no invite form or remove buttons, and can leave", async () => {
    const onLeft = vi.fn();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse({ members: [owner, guest] })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderDialog({ isOwner: false, onLeft });
    await screen.findByText("guest@example.com");

    expect(screen.queryByLabelText("Invite by email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove guest@example.com")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Leave chat" }));

    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(del?.[0]).toContain("/chats/chat-1/membership");
  });
});
