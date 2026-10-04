import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatListPage } from "./ChatListPage";
import { showsText, withBackend, withChatRoutes, withCurrentUser, withWorkspaceFrame, workspaceChats } from "./stories-support";

/** The `/chats` page: the workspace with no chat open, on a fake backend in the browser. */
const meta = {
  title: "App/Chat/ChatListPage",
  component: ChatListPage,
  decorators: [withChatRoutes, withCurrentUser, withWorkspaceFrame, withBackend],
  parameters: { layout: "fullscreen", path: "/chats", backend: { chats: workspaceChats } },
} satisfies Meta<typeof ChatListPage>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A few chats, one shared by a teammate. */
export const Default: Story = {
  play: showsText("SQL query review"),
};

/** A new user with no chats yet. */
export const Empty: Story = {
  parameters: { backend: { chats: [] } },
  play: showsText(/No chats yet/),
};
