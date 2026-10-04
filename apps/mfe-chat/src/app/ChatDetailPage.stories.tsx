import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatDetailPage } from "./ChatDetailPage";
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
 * The `/chats/$chatId` page: the chat named in the URL opens beside the list. The router
 * starts at `parameters.path`, so `useParams` reads the chat id as in the app.
 */
const meta = {
  title: "App/Chat/ChatDetailPage",
  component: ChatDetailPage,
  decorators: [withChatRoutes, withCurrentUser, withWorkspaceFrame, withBackend],
  parameters: {
    layout: "fullscreen",
    path: `/chats/${OPEN_CHAT_ID}`,
    backend: { chats: workspaceChats, messages: workspaceMessages },
  },
} satisfies Meta<typeof ChatDetailPage>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The chat from the URL, with a short finished conversation. */
export const Default: Story = {
  play: showsText("Keep Thursday free for unplanned work."),
};

/** A chat that was deleted or is not shared with the user (404). */
export const NotFound: Story = {
  parameters: { path: "/chats/00000000-0000-4000-8000-000000000000" },
  play: showsText(/It may have been deleted/),
};
