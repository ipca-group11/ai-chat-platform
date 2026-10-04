import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatView } from "./ChatView";
import {
  STORY_CHAT_ID,
  STORY_OTHER_USER_ID,
  STORY_USER_ID,
  assistantMessage,
  storyChat,
  storyConversation,
  storyLongConversation,
  storyReasoning,
  userMessage,
  withChatApi,
  type ChatApiParameters,
} from "./stories-support";

/**
 * A whole open chat: header and toggles, history, message queue and composer. The data
 * comes from `parameters.chatApi` through a seeded QueryClient; requests and the SSE
 * stream are answered in the browser (see `withChatApi`), so nothing reaches the network.
 */
const meta = {
  title: "App/Chat/ChatView",
  component: ChatView,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex h-[640px] flex-col overflow-hidden rounded-lg border border-border">
        <Story />
      </div>
    ),
    withChatApi,
  ],
  parameters: { layout: "fullscreen" },
  args: { chatId: STORY_CHAT_ID, userId: STORY_USER_ID },
} satisfies Meta<typeof ChatView>;
export default meta;

type Story = StoryObj<typeof meta>;

const chatApi = (api: ChatApiParameters) => ({ chatApi: api });

/** The owner's view of a finished exchange, with reasoning and web fetch on. */
export const Conversation: Story = {
  parameters: chatApi({ chat: storyChat, messages: storyConversation() }),
};

/** A new chat with no messages, on a model without reasoning or web fetch. */
export const Empty: Story = {
  parameters: chatApi({ chat: { ...storyChat, provider: "openai", model: "gpt-4o-mini", reasoning: false, webFetch: false } }),
};

/** A long history scrolls; the newest message is kept in view. */
export const LongConversation: Story = {
  parameters: chatApi({ chat: storyChat, messages: storyLongConversation() }),
};

/** A reply streaming, with a follow-up waiting in the queue. */
export const Streaming: Story = {
  parameters: chatApi({
    chat: storyChat,
    messages: [
      ...storyConversation(),
      userMessage("Can you add the deadlines to each item?"),
      assistantMessage("Sure, here are the deadlines:\n\n1. Release notes, **Tuesday**", {
        status: "streaming",
        reasoning: storyReasoning,
      }),
      userMessage("Also add who owns each one.", { status: "queued" }),
    ],
  }),
};

/** A reply that failed, with Retry. */
export const FailedReply: Story = {
  parameters: chatApi({
    chat: storyChat,
    messages: [
      userMessage("Summarise the roadmap for the team channel."),
      assistantMessage("", { status: "failed", error: "Rate limited by the provider. Try again in a minute." }),
    ],
  }),
};

/** A member of a shared chat: the owner-only toggles are disabled and the button reads "Members". */
export const SharedAsMember: Story = {
  args: { userId: STORY_OTHER_USER_ID },
  parameters: chatApi({
    chat: storyChat,
    messages: [
      userMessage("Can you turn my notes into a plan for this week?"),
      assistantMessage("Sure. What are the main deadlines?"),
      userMessage("Release notes are due Tuesday.", { authorId: STORY_OTHER_USER_ID, authorEmail: "rui@example.com" }),
      assistantMessage("Then the release notes come first, on **Monday**."),
    ],
  }),
};

/** In a split-view pane: tighter spacing, icon-only buttons and a close button. */
export const CompactPane: Story = {
  args: { compact: true, onClose: () => undefined },
  parameters: chatApi({ chat: storyChat, messages: storyConversation() }),
};

/** While the chat loads. */
export const Loading: Story = {
  parameters: chatApi({ chat: "loading" }),
};

/** The chat was deleted or the user has no access (403/404). */
export const NotFound: Story = {
  parameters: chatApi({ chat: "not-found" }),
};
