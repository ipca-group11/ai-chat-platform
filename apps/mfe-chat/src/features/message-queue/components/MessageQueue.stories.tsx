import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMessages } from "../../chat-view";
import type { Message } from "../../../shared/types";
import { withQueueApiStub, WithMessagesCache } from "../stories-support";
import { MessageQueue, type MessageQueueProps } from "./MessageQueue";

const CHAT_ID = "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6";
const ME = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const GUEST = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function message(id: string, content: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    chatId: CHAT_ID,
    authorId: ME,
    authorEmail: "ana@example.com",
    role: "user",
    content,
    attachments: [],
    status: "queued",
    createdAt: "2026-10-03T09:15:30.000Z",
    ...overrides,
  };
}

const streamingReply = message("a1b2c3d4-0000-4a7b-8c9d-0e1f2a3b4c5d", "Here is the summary you asked for…", {
  role: "assistant",
  status: "streaming",
  authorEmail: null,
});
const queue = [
  message("msg-q1", "Now turn those bullet points into an email to the team."),
  message("msg-q2", "Also list any action items with an owner and a due date."),
  message("msg-q3", "Finally, suggest a subject line under 60 characters."),
];

/** Reads the messages from the query cache, as the chat view does, so edits and cancels show up. */
function MessageQueueFromCache({ chatId, currentUserId }: Omit<MessageQueueProps, "messages">) {
  const { data = [] } = useMessages(chatId);
  return <MessageQueue chatId={chatId} messages={data} currentUserId={currentUserId} />;
}

/**
 * Messages waiting behind the reply that is still streaming, shown below the conversation
 * in send order. Only queued messages are listed; your own can be edited or canceled.
 */
const meta = {
  title: "App/Chat/MessageQueue",
  component: MessageQueue,
  tags: ["autodocs"],
  decorators: [WithMessagesCache],
  beforeEach: withQueueApiStub,
  args: {
    chatId: CHAT_ID,
    currentUserId: ME,
    messages: [streamingReply, ...queue],
  },
  render: (args) => <MessageQueueFromCache chatId={args.chatId} currentUserId={args.currentUserId} />,
} satisfies Meta<typeof MessageQueue>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Three of your messages queued behind the streaming reply. */
export const Queued: Story = {};

export const SingleMessage: Story = {
  args: { messages: [streamingReply, ...queue.slice(0, 1)] },
};

/** A shared chat: another member's queued message shows their email and can't be changed by you. */
export const SharedChat: Story = {
  args: {
    messages: [
      streamingReply,
      queue[0]!,
      message("msg-q4", "Can we add the budget numbers from last quarter?", {
        authorId: GUEST,
        authorEmail: "rui@example.com",
      }),
      queue[1]!,
    ],
  },
};
