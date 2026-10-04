import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageError } from "./MessageError";
import { assistantMessage } from "./stories-support";

/** The error shown under an assistant reply that failed, with Retry. */
const meta = {
  title: "App/Chat/MessageError",
  component: MessageError,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: {
    message: assistantMessage("", { status: "failed", error: "Rate limited by the provider. Try again in a minute." }),
    onRetry: () => undefined,
  },
} satisfies Meta<typeof MessageError>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The provider's error text. */
export const ProviderError: Story = {};

/** No error text from the provider: a generic message. */
export const GenericError: Story = {
  args: { message: assistantMessage("", { status: "failed", error: null }) },
};

/** Retry in progress: the button shows a spinner. */
export const Retrying: Story = {
  args: { retrying: true },
};
