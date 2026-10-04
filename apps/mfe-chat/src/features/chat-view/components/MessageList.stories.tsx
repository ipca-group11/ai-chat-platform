import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageList } from "./MessageList";
import {
  STORY_OTHER_USER_ID,
  STORY_USER_ID,
  assistantMessage,
  storyConversation,
  storyLongConversation,
  storyReasoning,
  userMessage,
} from "./stories-support";

/** The chat's history, as rendered inside the chat view's scroll area. */
const meta = {
  title: "App/Chat/MessageList",
  component: MessageList,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    messages: storyConversation(),
    currentUserId: STORY_USER_ID,
    onStop: () => undefined,
    onRetry: () => undefined,
  },
} satisfies Meta<typeof MessageList>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A question and a markdown answer, with reasoning and fetched pages. */
export const Conversation: Story = {};

/** A brand-new chat. */
export const Empty: Story = {
  args: { messages: [] },
};

/** The empty state in a short split-view pane. */
export const EmptyCompact: Story = {
  args: { messages: [], compact: true },
};

/** Many turns. */
export const LongConversation: Story = {
  args: { messages: storyLongConversation() },
};

/** The last reply is still streaming. */
export const Streaming: Story = {
  args: {
    messages: [
      ...storyConversation(),
      userMessage("Can you add the deadlines to each item?"),
      assistantMessage("Sure, here are the deadlines:\n\n1. Release notes, **Tuesday**", {
        status: "streaming",
        reasoning: storyReasoning,
      }),
    ],
  },
};

/** A failed reply in the middle of the history, with Retry. */
export const WithFailedReply: Story = {
  args: {
    messages: [
      ...storyConversation(),
      userMessage("And a summary for the team channel?"),
      assistantMessage("", { status: "failed", error: "The provider timed out after 60 seconds." }),
    ],
  },
};

/** A shared chat: another member's messages sit on the left, labelled with their email. Queued messages are not shown here. */
export const SharedChat: Story = {
  args: {
    messages: [
      userMessage("Can you turn my notes into a plan for this week?"),
      assistantMessage("Sure. What are the main deadlines?"),
      userMessage("Release notes are due Tuesday.", { authorId: STORY_OTHER_USER_ID, authorEmail: "rui@example.com" }),
      assistantMessage("Then the release notes come first, on **Monday**."),
      userMessage("This one waits in the queue", { status: "queued" }),
    ],
  },
};
