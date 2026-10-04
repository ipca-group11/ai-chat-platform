import {
  PROVIDERS,
  removeSessionApiKey,
  removeStoredApiKey,
  writeSessionApiKey,
  writeStoredApiKey,
} from "@app/shared-types/api-keys";
import type { Meta, StoryObj } from "@storybook/react-vite";
import App from "./app";
import type { CurrentUser } from "./features/api-keys/api/auth";
import { WithQueryClient, type SeedQueryClient } from "./features/api-keys/components/stories-support";

const user: CurrentUser = { id: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b", email: "ana@example.com" };

/** The query `useCurrentUserId` reads; seeding it means `GET /auth/me` is never sent. */
const signedIn: SeedQueryClient = (client) => client.setQueryData(["settings", "auth", "me"], user);

function clearStoredKeys() {
  for (const provider of PROVIDERS) {
    removeStoredApiKey(user.id, provider);
    removeSessionApiKey(user.id, provider);
  }
}

/**
 * Every story starts with no keys stored, and any request the page might send stays pending
 * instead of reaching a real server. Storage and `fetch` are restored afterwards.
 */
function withCleanStorageOffline() {
  clearStoredKeys();
  const realFetch = window.fetch;
  window.fetch = () => new Promise<Response>(() => undefined);
  return () => {
    window.fetch = realFetch;
    clearStoredKeys();
  };
}

/**
 * The `/settings` page as the shell mounts it: the page heading and intro, and a card per
 * LLM provider. Keys live only in this browser. The signed-in user is seeded into the
 * story's QueryClient, so the page renders its final state on the first render.
 */
const meta = {
  title: "App/Settings/App",
  component: App,
  tags: ["autodocs"],
  decorators: [WithQueryClient],
  parameters: { layout: "fullscreen", seed: signedIn },
  beforeEach: withCleanStorageOffline,
} satisfies Meta<typeof App>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A new user: no keys saved yet. */
export const NoKeysSaved: Story = {};

/** OpenAI and Anthropic keys saved in this tab session, so chats can use them. */
export const KeysSaved: Story = {
  beforeEach: () => {
    writeStoredApiKey(user.id, "openai", "sk-proj-4f9c2a7e1b3d");
    writeSessionApiKey(user.id, "openai", "sk-proj-4f9c2a7e1b3d");
    writeStoredApiKey(user.id, "anthropic", "sk-ant-api03-7c1e9d2f");
    writeSessionApiKey(user.id, "anthropic", "sk-ant-api03-7c1e9d2f");
  },
};
