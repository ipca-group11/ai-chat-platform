import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { expectNoA11yViolations } from "../../../test/a11y";
import { queryKeys } from "../../../shared/query-keys";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import type { Message } from "../../../shared/types";
import { Composer } from "./Composer";

vi.mock("../../chat-view/model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

const sentMessage: Message = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user",
  content: "Hello",
  attachments: [],
  status: "sent",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("Composer (AC-51, AC-66)", () => {
  it("AC-51: sends a typed message and clears the input", async () => {
    server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: sentMessage }, { status: 201 })));

    renderWithClient(<Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" />);

    const textbox = screen.getByLabelText("Message");
    await userEvent.type(textbox, "Hello");
    await userEvent.click(screen.getByText("Send"));

    await waitFor(() => expect(textbox).toHaveValue(""));
  });

  it("the Send button is disabled while the message is empty and there are no attachments", () => {
    renderWithClient(<Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" />);

    expect(screen.getByText("Send")).toBeDisabled();
  });

  it("AC-51: sends on Enter (without Shift) without inserting a newline", async () => {
    server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: sentMessage }, { status: 201 })));

    renderWithClient(<Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" />);

    const textbox = screen.getByLabelText("Message");
    await userEvent.type(textbox, "Hello{Enter}");

    await waitFor(() => expect(textbox).toHaveValue(""));
  });

  it("shows the send error when the message fails to send", async () => {
    server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: "Server error" }, { status: 500 })));

    renderWithClient(<Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" />);

    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByText("Send"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("AC-68: a rejected attachment blocks sending until it is removed", async () => {
    const requests = recordRequests();
    renderWithClient(<Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" />);

    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Attach a file"), file);

    expect(screen.getByText("Send")).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Remove big.txt"));
    await waitFor(() => expect(screen.getByText("Send")).toBeEnabled());
    expect(requests).toHaveLength(0);
  });

  describe("states of the composer", () => {
    const renderComposer = (props: Partial<Parameters<typeof Composer>[0]> = {}) =>
      renderWithClient(
        <Composer chatId="chat-1" userId="user-1" provider="anthropic" model="claude-3-5-haiku-latest" {...props} />
      );

    beforeEach(() => {
      window.sessionStorage.clear();
    });

    it("has no accessibility violations in its main state", async () => {
      const { container } = renderComposer();

      await expectNoA11yViolations(container);
    });

    it("sending: the Send button shows as busy and cannot be pressed twice until the server answers", async () => {
      let answer!: () => void;
      const gate = new Promise<void>((resolve) => (answer = resolve));
      const requests = recordRequests();
      server.use(
        http.post("*/chats/:chatId/messages", async () => {
          await gate;
          return HttpResponse.json({ message: sentMessage }, { status: 201 });
        })
      );
      renderComposer();

      await userEvent.type(screen.getByLabelText("Message"), "Hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      const sending = await screen.findByRole("button", { name: /send/i, busy: true });
      expect(sending).toBeDisabled();
      await userEvent.click(sending);
      expect(requests.filter((r) => r.method === "POST")).toHaveLength(1);

      answer();
      await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
      expect(screen.queryByRole("button", { busy: true })).not.toBeInTheDocument();
    });

    it("Shift+Enter inserts a new line and does not send", async () => {
      const requests = recordRequests();
      renderComposer();

      const textbox = screen.getByLabelText("Message");
      await userEvent.type(textbox, "first{Shift>}{Enter}{/Shift}second");

      expect(textbox).toHaveValue("first\nsecond");
      expect(requests).toHaveLength(0);
    });

    it("compact: one line with a short placeholder, and the Send button still works", async () => {
      server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: sentMessage }, { status: 201 })));
      renderComposer({ compact: true });

      const textbox = screen.getByLabelText("Message");
      expect(textbox).toHaveAttribute("rows", "1");
      expect(textbox).toHaveAttribute("placeholder", "Send a message…");

      await userEvent.type(textbox, "Hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(textbox).toHaveValue(""));
    });

    it("the regular layout shows the Shift+Enter hint and two rows", () => {
      renderComposer();

      const textbox = screen.getByLabelText("Message");
      expect(textbox).toHaveAttribute("rows", "2");
      expect(textbox).toHaveAttribute("placeholder", expect.stringContaining("Shift+Enter"));
    });

    it("AC-71: warns about an image for a model that cannot read images, and blocks Send until it is removed", async () => {
      const requests = recordRequests();
      renderComposer({ provider: "openai", model: "gpt-3.5-turbo" });

      await userEvent.type(screen.getByLabelText("Message"), "Look at this");
      await userEvent.upload(screen.getByLabelText("Attach a file"), new File(["x"], "photo.png", { type: "image/png" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("The selected model (openai/gpt-3.5-turbo) does not support image attachments.");
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

      await userEvent.click(screen.getByLabelText("Remove photo.png"));
      await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
      expect(requests).toHaveLength(0);
    });

    it("AC-56: a message the server queues (another reply is streaming) clears the input, shows no error and joins the cache as queued", async () => {
      const queued: Message = { ...sentMessage, id: "msg-2", content: "Next one", status: "queued" };
      server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: queued }, { status: 202 })));
      const { queryClient } = renderComposer();

      const textbox = screen.getByLabelText("Message");
      await userEvent.type(textbox, "Next one");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(textbox).toHaveValue(""));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(queryClient.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([queued]);
    });

    it("sends the session's API key for the chat's provider in the X-Llm-Api-Key header", async () => {
      window.sessionStorage.setItem("llm-api-key-session:user-1:anthropic", "sk-ant-session");
      window.sessionStorage.setItem("llm-api-key-session:user-1:openai", "sk-other-provider");
      server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: sentMessage }, { status: 201 })));
      const requests = recordRequests();
      renderComposer();

      await userEvent.type(screen.getByLabelText("Message"), "Hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(requests.find((r) => r.method === "POST")).toBeDefined());
      expect(requests.find((r) => r.method === "POST")!.headers.get("X-Llm-Api-Key")).toBe("sk-ant-session");
    });

    it("sends no key header when no key was entered in this session", async () => {
      server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: sentMessage }, { status: 201 })));
      const requests = recordRequests();
      renderComposer();

      await userEvent.type(screen.getByLabelText("Message"), "Hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(requests.find((r) => r.method === "POST")).toBeDefined());
      expect(requests.find((r) => r.method === "POST")!.headers.has("X-Llm-Api-Key")).toBe(false);
    });
  });
});
