import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Attachment } from "../../../shared/types";
import type { PendingAttachment } from "../hooks/usePendingAttachments";
import { AttachmentList } from "./AttachmentList";

const uploadedNotes: Attachment = {
  id: "c0ffee00-1234-4abc-9def-0123456789ab",
  messageId: "",
  filename: "notes.pdf",
  mimeType: "application/pdf",
  size: 20480,
  kind: "pdf",
};

function pending(id: string, name: string, type: string, rest: Omit<PendingAttachment, "id" | "file">): PendingAttachment {
  return { id, file: new File(["x"], name, { type }), ...rest };
}

const uploading = pending("whiteboard", "whiteboard.png", "image/png", { status: "uploading" });
const uploaded = pending("notes", "notes.pdf", "application/pdf", { status: "uploaded", attachment: uploadedNotes });
const tooLarge = pending("transcript", "recording-transcript.txt", "text/plain", {
  status: "rejected",
  error: '"recording-transcript.txt" is larger than the 10 MB limit.',
});
const wrongType = pending("setup", "setup.exe", "application/x-msdownload", {
  status: "rejected",
  error: '"setup.exe" is not a supported file type. Allowed types: .txt, .pdf, .png, .jpg/.jpeg.',
});
const unsupportedByModel = pending("architecture", "architecture.png", "image/png", {
  status: "rejected",
  error: "The selected model (ollama/llama3.2:3b) does not support image attachments.",
});

/**
 * Files staged on the message being composed, shown inside the composer above the text
 * field. Each chip shows its upload state, or the reason it was rejected.
 */
const meta = {
  title: "App/Chat/AttachmentList",
  component: AttachmentList,
  tags: ["autodocs"],
  args: {
    attachments: [uploaded],
    onRemove: () => undefined,
  },
} satisfies Meta<typeof AttachmentList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Uploaded: Story = {};

export const Uploading: Story = {
  args: { attachments: [uploading] },
};

/** Every reason a file can be refused before it is sent. */
export const Rejected: Story = {
  args: { attachments: [tooLarge, wrongType, unsupportedByModel] },
};

/** A realistic mix, as it appears while a few files are being added at once. */
export const Mixed: Story = {
  args: { attachments: [uploaded, uploading, tooLarge] },
};
