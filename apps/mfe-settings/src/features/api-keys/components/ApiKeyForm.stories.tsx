import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApiKeyForm } from "./ApiKeyForm";
import { getButton, settle, typeInto, withApiStub, WithQueryClient } from "./stories-support";

/**
 * Add, update or remove one provider's key, with "Test connection" underneath. In the app
 * it sits inside the provider's card in the settings page (see ProviderList).
 */
const meta = {
  title: "App/Settings/ApiKeyForm",
  component: ApiKeyForm,
  tags: ["autodocs"],
  decorators: [
    WithQueryClient,
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  beforeEach: withApiStub,
  args: {
    provider: "openai",
    providerLabel: "OpenAI",
    hasKey: false,
    onSave: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof ApiKeyForm>;
export default meta;

type Story = StoryObj<typeof meta>;

/** No key saved yet. */
export const NoKeySaved: Story = {};

/** A key is saved: the form updates it, and it can be removed. */
export const KeySaved: Story = {
  args: { provider: "anthropic", providerLabel: "Anthropic", hasKey: true },
};

/** A key typed but not saved yet: it can already be tested. */
export const KeyTyped: Story = {
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("#openai-api-key");
    if (input) typeInto(input, "sk-proj-4f9c2a7e1b3d");
    await settle();
  },
};

/** Saving with an empty field shows the validation message. */
export const Required: Story = {
  play: async ({ canvasElement }) => {
    getButton(canvasElement, "Save key").click();
    await settle();
  },
};

/** The browser refused to store the new key: the error says the previous key is still in use. */
export const SaveFailed: Story = {
  args: {
    hasKey: true,
    onSave: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("#openai-api-key");
    if (input) typeInto(input, "sk-proj-4f9c2a7e1b3d");
    await settle();
    getButton(canvasElement, "Update key").click();
    await settle();
  },
};
