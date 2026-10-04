import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  getButton,
  settle,
  typeInto,
  withApiStub,
  WithQueryClient,
  type SeedQueryClient,
} from "../../../shared/stories-support";
import { DeleteAccountCard } from "./DeleteAccountCard";

/** The signed-in user, as `GET /auth/me` answers. */
const user = { id: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b", email: "ana@example.com" };

/** The query `useCurrentUserId` reads; seeding it means `GET /auth/me` is never sent. */
const signedIn: SeedQueryClient = (client) => client.setQueryData(["settings", "auth", "me"], user);

/** The dialog renders in a portal, outside the story's canvas. */
const dialogOf = (): HTMLElement => {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error("The dialog is not open");
  return dialog;
};

async function openDialog(canvasElement: HTMLElement): Promise<HTMLElement> {
  getButton(canvasElement, "Delete account").click();
  await settle();
  return dialogOf();
}

/** Opens the dialog, types the password and confirms. */
async function confirmWith(canvasElement: HTMLElement, password: string): Promise<void> {
  const dialog = await openDialog(canvasElement);
  const input = dialog.querySelector<HTMLInputElement>('input[type="password"]');
  if (input) typeInto(input, password);
  await settle();
  getButton(dialog, "Delete account").click();
  await settle(100);
}

/**
 * The end of the settings page: deleting the account. The dialog asks for the password again
 * before `DELETE /auth/me` erases the account and everything it owns; then the user is sent to
 * sign in (not in these stories: `onDeleted` does nothing here).
 */
const meta = {
  title: "App/Settings/DeleteAccountCard",
  component: DeleteAccountCard,
  tags: ["autodocs"],
  decorators: [WithQueryClient],
  parameters: { layout: "padded", seed: signedIn },
  beforeEach: withApiStub,
  args: { onDeleted: () => undefined },
} satisfies Meta<typeof DeleteAccountCard>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The card, before anything is clicked. */
export const Default: Story = {};

/** The confirmation dialog, waiting for the password. */
export const ConfirmDialog: Story = {
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
  },
};

/** Confirmed without a password: nothing is sent. */
export const PasswordRequired: Story = {
  play: async ({ canvasElement }) => {
    await confirmWith(canvasElement, "");
  },
};

/** auth-service refused the password. */
export const WrongPassword: Story = {
  parameters: {
    api: [
      {
        method: "DELETE",
        path: /^\/auth\/me$/,
        respond: { status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "Invalid password" } } },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await confirmWith(canvasElement, "not-my-password");
  },
};

/** The account is being deleted: the buttons are busy and the dialog cannot be closed. */
export const Deleting: Story = {
  parameters: { api: [{ method: "DELETE", path: /^\/auth\/me$/, respond: "pending" }] },
  play: async ({ canvasElement }) => {
    await confirmWith(canvasElement, "Secret-pass-123");
  },
};
