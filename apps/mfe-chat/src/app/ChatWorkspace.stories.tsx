import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatWorkspace } from "./ChatWorkspace";
import {
  OPEN_CHAT_ID,
  showsText,
  withBackend,
  withChatRoutes,
  withCurrentUser,
  withWorkspaceFrame,
  workspaceChats,
  workspaceMessages,
} from "./stories-support";

/**
 * The chat layout: the list as a sidebar and the open chat beside it. It runs on the
 * remote's own routes with a fake backend in the browser (see `withBackend`), so nothing
 * reaches the network.
 */
const meta = {
  title: "App/Chat/ChatWorkspace",
  component: ChatWorkspace,
  decorators: [withChatRoutes, withCurrentUser, withWorkspaceFrame, withBackend],
  parameters: { layout: "fullscreen", backend: { chats: workspaceChats, messages: workspaceMessages } },
} satisfies Meta<typeof ChatWorkspace>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The list with no chat open: a prompt to pick one. */
export const NoChatOpen: Story = {
  play: showsText("Refactor the auth middleware"),
};

/** A chat open beside the list, with a short finished conversation. */
export const ChatOpen: Story = {
  args: { chatId: OPEN_CHAT_ID },
  play: showsText("Keep Thursday free for unplanned work."),
};

/** A new user with no chats yet. */
export const EmptyList: Story = {
  parameters: { backend: { chats: [] } },
  play: showsText(/No chats yet/),
};
