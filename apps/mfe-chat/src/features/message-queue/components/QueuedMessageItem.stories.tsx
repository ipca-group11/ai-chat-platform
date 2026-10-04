import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Message } from "../../../shared/types";
import { QueuedMessageItem } from "./QueuedMessageItem";

const queuedMessage: Message = {
  id: "msg-q1",
  chatId: "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
  authorId: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
  authorEmail: "ana@example.com",
  role: "user",
  content: "Now turn those bullet points into an email to the team.",
  attachments: [],
  status: "queued",
  createdAt: "2026-10-03T09:15:30.000Z",
};

/** One row of the message queue. It renders a list item, so each story sits in the queue's list. */
const meta = {
  title: "App/Chat/QueuedMessageItem",
  component: QueuedMessageItem,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ul className="max-w-xl space-y-1">
        <Story />
      </ul>
    ),
  ],
  args: {
    message: queuedMessage,
    onEdit: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof QueuedMessageItem>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Your own queued message, with edit and cancel actions. */
export const Editable: Story = {};

/** Editing in place, before the message is processed. */
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>(`[aria-label="Edit ${queuedMessage.content}"]`)?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
  },
};

/** Long text is truncated to one line. */
export const LongMessage: Story = {
  args: {
    message: {
      ...queuedMessage,
      content:
        "Also list any action items with an owner and a due date, group them by team, and flag anything that was already overdue at the last planning meeting.",
    },
  },
};

/** Another member's message in a shared chat: shows who sent it, without actions. */
export const FromAnotherMember: Story = {
  args: {
    editable: false,
    message: {
      ...queuedMessage,
      authorId: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      authorEmail: "rui@example.com",
      content: "Can we add the budget numbers from last quarter?",
    },
  },
};
