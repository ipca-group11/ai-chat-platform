import type { Meta, StoryObj } from "@storybook/react-vite";
import { NewChatDialog } from "./NewChatDialog";

const meta = {
  title: "App/Chat/NewChatDialog",
  component: NewChatDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onClose: () => undefined,
    onCreate: () => undefined,
  },
} satisfies Meta<typeof NewChatDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Fresh form: Ollama's default model, Create disabled until there is a title. */
export const Default: Story = {};

/** While the create request is in flight. */
export const Submitting: Story = {
  args: { submitting: true },
};
