import type { Meta, StoryObj } from "@storybook/react-vite";
import { MaskedKeyDisplay } from "./MaskedKeyDisplay";

/** A saved key shown back to the user: only its last 4 characters, never the full value. */
const meta = {
  title: "App/Settings/MaskedKeyDisplay",
  component: MaskedKeyDisplay,
  tags: ["autodocs"],
  args: {
    record: { provider: "openai", last4: "a1b2", createdAt: "2026-10-03T09:15:30.000Z" },
  },
} satisfies Meta<typeof MaskedKeyDisplay>;
export default meta;

type Story = StoryObj<typeof meta>;

export const KeySet: Story = {};

export const NoKey: Story = {
  args: { record: null },
};
