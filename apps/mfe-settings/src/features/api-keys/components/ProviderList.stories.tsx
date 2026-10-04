import {
  PROVIDERS,
  removeSessionApiKey,
  removeStoredApiKey,
  writeSessionApiKey,
  writeStoredApiKey,
  type Provider,
} from "@app/shared-types/api-keys";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CurrentUser } from "../api/auth";
import { ProviderList } from "./ProviderList";
import { withApiStub, WithQueryClient, type SeedQueryClient, type StubRoute } from "../../../shared/stories-support";

const user: CurrentUser = { id: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b", email: "ana@example.com" };

/** The query `useCurrentUserId` reads; seeding it means `GET /auth/me` is never sent. */
const signedIn: SeedQueryClient = (client) => client.setQueryData(["settings", "auth", "me"], user);

const RAW_KEYS: Record<Exclude<Provider, "ollama">, string> = {
  openai: "sk-proj-4f9c2a7e1b3d",
  anthropic: "sk-ant-api03-7c1e9d2f",
};

type KeyState = "this-session" | "earlier-session";

function clearStoredKeys() {
  for (const provider of PROVIDERS) {
    removeStoredApiKey(user.id, provider);
    removeSessionApiKey(user.id, provider);
  }
}

/** Every story starts with no keys stored and the API stubbed, and leaves nothing behind. */
function withCleanStorage(context: { parameters: { api?: readonly StubRoute[] } }) {
  clearStoredKeys();
  const restoreFetch = withApiStub(context);
  return () => {
    restoreFetch();
    clearStoredKeys();
  };
}

/**
 * Puts the user's keys in browser storage the way the settings page saves them: the masked
 * record in localStorage, and the usable key in sessionStorage only for keys entered in this
 * tab session.
 */
function storeKeys(keys: Partial<Record<keyof typeof RAW_KEYS, KeyState>>) {
  return () => {
    for (const [provider, state] of Object.entries(keys) as [keyof typeof RAW_KEYS, KeyState][]) {
      writeStoredApiKey(user.id, provider, RAW_KEYS[provider]);
      if (state === "this-session") writeSessionApiKey(user.id, provider, RAW_KEYS[provider]);
    }
  };
}

/**
 * The settings page's provider cards: OpenAI and Anthropic with their key forms, and Ollama,
 * which runs locally and needs no key. Keys live only in this browser.
 */
const meta = {
  title: "App/Settings/ProviderList",
  component: ProviderList,
  tags: ["autodocs"],
  decorators: [WithQueryClient],
  parameters: { layout: "padded", seed: signedIn },
  beforeEach: withCleanStorage,
} satisfies Meta<typeof ProviderList>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A new user: no keys yet. */
export const NoKeysConfigured: Story = {};

/** Both keys entered in this tab session, so chats can use them. */
export const KeysConfigured: Story = {
  beforeEach: storeKeys({ openai: "this-session", anthropic: "this-session" }),
};

/** Keys saved in an earlier session must be entered again; OpenAI was, Anthropic wasn't. */
export const ReEnterKey: Story = {
  beforeEach: storeKeys({ openai: "this-session", anthropic: "earlier-session" }),
};

/** Waiting for the signed-in user. */
export const Loading: Story = {
  parameters: { seed: null, api: [{ method: "GET", path: /^\/auth\/me$/, respond: "pending" }] },
};

/** No session: the page asks the user to sign in. */
export const SignedOut: Story = {
  parameters: { seed: null, api: [{ method: "GET", path: /^\/auth\/me$/, respond: { status: 401 } }] },
};
