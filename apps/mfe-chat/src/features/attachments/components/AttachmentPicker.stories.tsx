import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentPicker } from "./AttachmentPicker";

/**
 * The composer's "Attach" button. It opens the browser's file dialog, limited to the
 * allowed types (.txt, .pdf, .png, .jpg/.jpeg).
 */
const meta = {
  title: "App/Chat/AttachmentPicker",
  component: AttachmentPicker,
  tags: ["autodocs"],
  args: {
    onSelect: () => undefined,
  },
} satisfies Meta<typeof AttachmentPicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
