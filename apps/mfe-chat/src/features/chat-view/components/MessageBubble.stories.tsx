import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageBubble } from "./MessageBubble";
import {
  STORY_OTHER_USER_ID,
  STORY_USER_ID,
  assistantMessage,
  markdownReply,
  storyConversation,
  storyReasoning,
  storyWebFetches,
  userMessage,
} from "./stories-support";

/** One message of a chat. The bubble is an `<li>`, so every story renders it inside the list it belongs to. */
const meta = {
  title: "App/Chat/MessageBubble",
  component: MessageBubble,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ul className="mx-auto max-w-3xl space-y-6">
        <Story />
      </ul>
    ),
  ],
  args: {
    currentUserId: STORY_USER_ID,
    onStop: () => undefined,
    onRetry: () => undefined,
  },
} satisfies Meta<typeof MessageBubble>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Your own message: right-aligned, primary colour. */
export const UserMessage: Story = {
  args: { message: userMessage("Can you turn my notes into a plan for this week?") },
};

/** Your message with a file attached. */
export const UserMessageWithAttachment: Story = {
  args: { message: storyConversation()[0]! },
};

/** In a shared chat, another member's message is labelled with their email. */
export const OtherMemberMessage: Story = {
  args: {
    message: userMessage("I can take the code reviews on Wednesday.", {
      authorId: STORY_OTHER_USER_ID,
      authorEmail: "rui@example.com",
    }),
  },
};

/** The assistant's reply is markdown, rendered with the `typeset typeset-chat` prose styles. */
export const AssistantMarkdown: Story = {
  args: { message: assistantMessage(markdownReply) },
};

/** A finished reply with its reasoning (collapsed) and the pages it read. */
export const AssistantWithReasoningAndSources: Story = {
  args: { message: assistantMessage(markdownReply, { reasoning: storyReasoning, webFetches: storyWebFetches }) },
};

/** Images in replies are never loaded; the alt text is shown instead. */
export const AssistantWithBlockedImage: Story = {
  args: {
    message: assistantMessage("Here is the chart:\n\n![Weekly velocity chart](https://images.example.com/velocity.png)"),
  },
};

/** Waiting for the first token: typing dots and the Stop button. */
export const StreamingWaiting: Story = {
  args: { message: assistantMessage("", { status: "streaming" }) },
};

/** Thinking before answering: the reasoning is open while the model is still thinking. */
export const StreamingThinking: Story = {
  args: { message: assistantMessage("", { status: "streaming", reasoning: storyReasoning }) },
};

/** Tokens arriving: the partial answer is rendered as it streams. */
export const StreamingAnswer: Story = {
  args: {
    message: assistantMessage("Here is a plan for the week, based on the notes you shared:\n\n## Priorities\n\n1. **Finish the", {
      status: "streaming",
      reasoning: storyReasoning,
      webFetches: [{ id: "fetching-1", url: "https://example.com/article", status: "fetching" }],
    }),
  },
};

/** The provider failed: the error and a Retry button. */
export const Failed: Story = {
  args: { message: assistantMessage("", { status: "failed", error: "Rate limited by the provider. Try again in a minute." }) },
};

/** Retry in progress. */
export const Retrying: Story = {
  args: { message: assistantMessage("", { status: "failed", error: "provider timeout" }), retrying: true },
};

/** With "show thinking" turned off, the reasoning is not shown. */
export const ReasoningHidden: Story = {
  args: {
    message: assistantMessage(markdownReply, { reasoning: storyReasoning }),
    showReasoning: false,
  },
};
