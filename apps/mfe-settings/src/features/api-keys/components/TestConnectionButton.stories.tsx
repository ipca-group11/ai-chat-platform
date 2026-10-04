import type { Meta, StoryObj } from "@storybook/react-vite";
import { getButton, settle, withApiStub, WithQueryClient, type StubRoute } from "../../../shared/stories-support";
import { TestConnectionButton } from "./TestConnectionButton";

const TEST_CONNECTION = /^\/providers\/[^/]+\/test-connection$/;

function answer(respond: StubRoute["respond"]): StubRoute[] {
  return [{ method: "POST", path: TEST_CONNECTION, respond }];
}

/** Presses the button, as the user would, once the story has rendered. */
async function pressTest({ canvasElement }: { canvasElement: HTMLElement }) {
  getButton(canvasElement, /^Test .+ connection$/).click();
  await settle(100);
}

/**
 * "Test connection" under each provider's key form. It sends the typed key once to
 * conversation-service and shows whether the provider accepted it.
 */
const meta = {
  title: "App/Settings/TestConnectionButton",
  component: TestConnectionButton,
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
  parameters: { api: answer({ status: 200, body: { success: true } }) },
  args: {
    provider: "openai",
    providerLabel: "OpenAI",
    apiKey: "sk-proj-4f9c2a7e1b3d",
  },
} satisfies Meta<typeof TestConnectionButton>;
export default meta;

type Story = StoryObj<typeof meta>;

/** No key typed yet, so there is nothing to test. */
export const NoKey: Story = {
  args: { apiKey: "" },
};

export const Ready: Story = {};

/** Waiting for the provider to answer. */
export const Testing: Story = {
  parameters: { api: answer("pending") },
  play: pressTest,
};

export const Success: Story = {
  play: pressTest,
};

/** The provider refused the key: its reason is shown. */
export const Rejected: Story = {
  args: { provider: "anthropic", providerLabel: "Anthropic", apiKey: "sk-ant-api03-expired" },
  parameters: { api: answer({ status: 401, body: { message: "The provider rejected the API key" } }) },
  play: pressTest,
};

/** conversation-service couldn't be reached at all. */
export const NetworkError: Story = {
  parameters: { api: answer("network-error") },
  play: pressTest,
};
