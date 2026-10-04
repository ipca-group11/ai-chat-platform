import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Provider } from "../../../shared/types";
import { ProviderModelSelect } from "./ProviderModelSelect";

const meta = {
  title: "App/Chat/ProviderModelSelect",
  component: ProviderModelSelect,
  tags: ["autodocs"],
  // Controlled like in NewChatDialog, so picking a provider or model updates the selects.
  render: function Controlled(args) {
    const [value, setValue] = useState<{ provider: Provider; model: string }>({
      provider: args.provider,
      model: args.model,
    });
    return (
      <div className="max-w-md">
        <ProviderModelSelect
          {...args}
          provider={value.provider}
          model={value.model}
          onChange={(next) => {
            setValue(next);
            args.onChange(next);
          }}
        />
      </div>
    );
  },
  args: {
    provider: "ollama",
    model: "llama3.2:1b",
    onChange: () => undefined,
  },
} satisfies Meta<typeof ProviderModelSelect>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ollama: Story = {};

export const OpenAI: Story = {
  args: { provider: "openai", model: "gpt-4o" },
};

export const Anthropic: Story = {
  args: { provider: "anthropic", model: "claude-haiku-4-5" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
