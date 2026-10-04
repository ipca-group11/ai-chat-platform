import type { Meta, StoryObj } from "@storybook/react-vite";
import { CurrentUserGate, useCurrentUserId } from "./auth-context";
import { showsText, withBackend, withCurrentUser } from "./stories-support";

/** Stands in for the remote's pages: shows whose session the gate resolved. */
function SignedInAs() {
  return (
    <p className="p-4 text-sm">
      Signed in as <code>{useCurrentUserId()}</code>
    </p>
  );
}

/**
 * The gate the remote's pages render behind: it reuses a user id provided higher up, or
 * loads it from `GET /auth/me` (answered by a fake backend in the browser).
 */
const meta = {
  title: "App/Chat/CurrentUserGate",
  component: CurrentUserGate,
  decorators: [
    (Story) => (
      <div className="flex h-[320px] flex-col">
        <Story />
      </div>
    ),
    withBackend,
  ],
  parameters: { layout: "fullscreen", backend: { chats: [] } },
  args: { children: <SignedInAs /> },
} satisfies Meta<typeof CurrentUserGate>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The user id comes from a `CurrentUserProvider` (standalone mount): no session request. */
export const ProvidedUser: Story = {
  decorators: [withCurrentUser],
};

/** No id provided: the session resolves and the children render. */
export const FromSession: Story = {
  play: showsText(/Signed in as/),
};

/** While `GET /auth/me` is in flight. */
export const LoadingSession: Story = {
  parameters: { backend: { chats: [], session: "pending" } },
};

/** The session check failed (401): the user is asked to sign in again. */
export const SessionCheckFailed: Story = {
  parameters: { backend: { chats: [], session: 401 } },
  play: showsText("Your session could not be verified. Please sign in again."),
};
