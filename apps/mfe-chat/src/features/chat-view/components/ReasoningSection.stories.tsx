import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReasoningSection } from "./ReasoningSection";
import { storyReasoning } from "./stories-support";

/** The model's reasoning shown above its answer. */
const meta = {
  title: "App/Chat/ReasoningSection",
  component: ReasoningSection,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: { reasoning: storyReasoning, thinking: false },
} satisfies Meta<typeof ReasoningSection>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Once the answer has started the reasoning is collapsed. */
export const Collapsed: Story = {};

/** While the model is still thinking it is open, with a pulsing label. */
export const Thinking: Story = {
  args: { thinking: true },
};

/** Opened by the user after the answer arrived. */
export const ExpandedByUser: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click();
  },
};

/** Reasoning longer than the panel: it scrolls, and can be focused to scroll by keyboard. */
export const LongReasoning: Story = {
  args: { thinking: true, reasoning: Array.from({ length: 12 }, () => storyReasoning).join("\n\n") },
};
