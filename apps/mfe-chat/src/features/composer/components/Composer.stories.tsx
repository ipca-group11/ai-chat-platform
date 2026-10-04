import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Attachment } from "../../../shared/types";
import {
  chooseFiles,
  getButton,
  getByLabel,
  makeFile,
  settle,
  typeInto,
  withApiStub,
  WithQueryClient,
  type StubRoute,
} from "../stories-support";
import { Composer } from "./Composer";

const CHAT_ID = "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6";
const PROMPT = "Can you summarise the attached meeting notes in three bullet points?";

const uploadedNotes: Attachment = {
  id: "c0ffee00-1234-4abc-9def-0123456789ab",
  messageId: "",
  filename: "notes.pdf",
  mimeType: "application/pdf",
  size: 20480,
  kind: "pdf",
};

/** Uploads answer straight away, except `whiteboard.png`, which stays in flight. */
const attachmentRoutes: StubRoute[] = [
  {
    method: "POST",
    path: /\/chats\/[^/]+\/attachments$/,
    respond: (body) => {
      const file = body instanceof FormData ? body.get("file") : null;
      if (file instanceof File && file.name === "whiteboard.png") return "pending";
      return { status: 201, body: { attachment: uploadedNotes } };
    },
  },
];

/**
 * The message composer as it sits under a chat. State comes from its real hooks
 * (`useComposer` → `useSendMessage`/`usePendingAttachments`), so the stories reach each
 * state by typing and attaching through `play`, against in-memory API answers.
 */
const meta = {
  title: "App/Chat/Composer",
  component: Composer,
  tags: ["autodocs"],
  decorators: [WithQueryClient],
  beforeEach: withApiStub,
  parameters: { api: attachmentRoutes },
  args: {
    chatId: CHAT_ID,
    userId: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
    provider: "anthropic",
    model: "claude-haiku-4-5",
  },
} satisfies Meta<typeof Composer>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Nothing typed yet: Send stays disabled. */
export const Empty: Story = {};

/** The one-line layout used by split-view panes. */
export const Compact: Story = {
  args: { compact: true },
};

/** A message typed: Send is enabled. */
export const Typing: Story = {
  play: async ({ canvasElement }) => {
    typeInto(getByLabel(canvasElement, "Message"), PROMPT);
    await settle();
  },
};

/** One file uploaded and one still uploading; Send waits for the upload to finish. */
export const WithAttachments: Story = {
  play: async ({ canvasElement }) => {
    typeInto(getByLabel(canvasElement, "Message"), PROMPT);
    const picker = getByLabel<HTMLInputElement>(canvasElement, "Attach a file");
    chooseFiles(picker, [makeFile("notes.pdf", "application/pdf", 20480)]);
    await settle();
    chooseFiles(picker, [makeFile("whiteboard.png", "image/png", 184_320)]);
    await settle();
  },
};

/**
 * Files rejected before upload: one over the 10 MB limit, one of a disallowed type, and an
 * image the local Ollama model can't read. Send is blocked until they are removed.
 */
export const RejectedAttachments: Story = {
  args: { provider: "ollama", model: "llama3.2:3b" },
  play: async ({ canvasElement }) => {
    typeInto(getByLabel(canvasElement, "Message"), "What does this diagram show?");
    chooseFiles(getByLabel(canvasElement, "Attach a file"), [
      makeFile("recording-transcript.txt", "text/plain", 11 * 1024 * 1024),
      makeFile("setup.exe", "application/x-msdownload"),
      makeFile("architecture.png", "image/png"),
    ]);
    await settle();
  },
};

/** Waiting for the server to accept the message: Send shows as busy. */
export const Sending: Story = {
  parameters: {
    api: [...attachmentRoutes, { method: "POST", path: /\/chats\/[^/]+\/messages$/, respond: "pending" }],
  },
  play: async ({ canvasElement }) => {
    typeInto(getByLabel(canvasElement, "Message"), PROMPT);
    await settle();
    getButton(canvasElement, "Send").click();
    await settle();
  },
};

/** The server refused the message: the error is shown under the composer and the text is kept. */
export const SendFailed: Story = {
  parameters: {
    api: [
      ...attachmentRoutes,
      {
        method: "POST",
        path: /\/chats\/[^/]+\/messages$/,
        respond: { status: 401, body: { message: "Add your Anthropic API key in Settings to use this model." } },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    typeInto(getByLabel(canvasElement, "Message"), PROMPT);
    await settle();
    getButton(canvasElement, "Send").click();
    await settle(150);
  },
};
