import type { Meta, StoryObj } from "@storybook/react-vite";
import { queryKeys } from "../../../shared/query-keys";
import { ChatList } from "./ChatList";
import { CURRENT_USER_ID, manyChats, sampleChats, withQueryClient } from "./stories-support";

const meta = {
  title: "App/Chat/ChatList",
  component: ChatList,
  tags: ["autodocs"],
  // The list fills the chat page's sidebar; give it the same fixed width and a bounded height.
  decorators: [
    (Story) => (
      <div className="h-[560px] w-72 border border-border">
        <Story />
      </div>
    ),
    withQueryClient,
  ],
  args: {
    currentUserId: CURRENT_USER_ID,
    onOpenChat: () => undefined,
  },
  parameters: {
    queries: [{ key: queryKeys.chats(), data: sampleChats }],
  },
} satisfies Meta<typeof ChatList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One chat focused, another open in a second split-view pane, split actions enabled. */
export const WithActiveAndSplitPanes: Story = {
  args: {
    activeChatId: sampleChats[0]!.id,
    openChatIds: [sampleChats[0]!.id, sampleChats[3]!.id],
    onOpenChatInSplit: () => undefined,
  },
};

export const ManyChats: Story = {
  parameters: { queries: [{ key: queryKeys.chats(), data: manyChats }] },
};

export const Empty: Story = {
  parameters: { queries: [{ key: queryKeys.chats(), data: [] }] },
};

export const Loading: Story = {
  parameters: { queries: [{ key: queryKeys.chats(), loading: true }] },
};

export const LoadError: Story = {
  parameters: { queries: [{ key: queryKeys.chats(), error: "Internal Server Error" }] },
};

/** After clicking "New chat". */
export const NewChatDialogOpen: Story = {
  play: async ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll("button")).find((b) => b.textContent?.includes("New chat"));
    button?.click();
    // The dialog is loaded on the first open (AICHAT-239): wait until it is on the page.
    for (let i = 0; i < 100 && !document.querySelector('[role="dialog"]'); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  },
};
