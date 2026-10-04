import type { Meta, StoryObj } from "@storybook/react-vite";
import { queryKeys } from "../../../shared/query-keys";
import { MembersDialog } from "./MembersDialog";
import { SAMPLE_CHAT, sampleMembers, withQueryClient } from "./stories-support";

const chat = SAMPLE_CHAT;

const meta = {
  title: "App/Chat/MembersDialog",
  component: MembersDialog,
  tags: ["autodocs"],
  decorators: [withQueryClient],
  args: {
    chatId: chat.id,
    chatTitle: chat.title,
    isOwner: true,
    open: true,
    onClose: () => undefined,
    onLeft: () => undefined,
  },
  parameters: {
    queries: [{ key: queryKeys.members(chat.id), data: sampleMembers }],
  },
} satisfies Meta<typeof MembersDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The owner can invite by email and remove members. */
export const AsOwner: Story = {};

/** The chat has not been shared yet: only the owner is listed. */
export const OwnerOnly: Story = {
  parameters: { queries: [{ key: queryKeys.members(chat.id), data: sampleMembers.slice(0, 1) }] },
};

/** A member sees the list read-only and can leave the chat. */
export const AsMember: Story = {
  args: { isOwner: false },
};

export const Loading: Story = {
  parameters: { queries: [{ key: queryKeys.members(chat.id), loading: true }] },
};

export const LoadError: Story = {
  parameters: { queries: [{ key: queryKeys.members(chat.id), error: "Internal Server Error" }] },
};
