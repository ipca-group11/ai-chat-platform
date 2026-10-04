import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatListItem } from "./ChatListItem";
import { sampleChats } from "./stories-support";

const [ownChat, , sharedChat] = sampleChats;

const meta = {
  title: "App/Chat/ChatListItem",
  component: ChatListItem,
  tags: ["autodocs"],
  // A row is an <li>; render it inside a sidebar-width list like ChatList does.
  decorators: [
    (Story) => (
      <ul aria-label="Chats" className="w-72 space-y-1">
        <Story />
      </ul>
    ),
  ],
  args: {
    chat: ownChat!,
    onOpen: () => undefined,
    onRename: () => undefined,
    onDelete: () => undefined,
  },
} satisfies Meta<typeof ChatListItem>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The chat shown in the focused pane. */
export const Active: Story = {
  args: { active: true },
};

/** Open in another split-view pane, but not the focused one. */
export const OpenInOtherPane: Story = {
  args: { open: true },
};

/** With split view available, the row also offers "open to the right" and "open below". */
export const WithSplitActions: Story = {
  args: { onOpenInSplit: () => undefined },
};

/** Shared by someone else: shows the owner and hides rename/delete. */
export const SharedWithYou: Story = {
  args: { chat: sharedChat!, shared: true },
};

export const LongTitle: Story = {
  args: {
    chat: { ...ownChat!, title: "Compare the three hosting offers and draft a recommendation for the team" },
  },
};

/** After clicking the pencil: the inline rename form. */
export const Renaming: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>(`[aria-label="Rename ${ownChat!.title}"]`)?.click();
  },
};
