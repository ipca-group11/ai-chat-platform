import { PROVIDERS, removeSessionApiKey, removeStoredApiKey } from "@app/shared-types/api-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@app/ui";
import { useCurrentUserId } from "../../api-keys";
import { DeleteAccountError, deleteAccount } from "../api/deleteAccount";

export interface DeleteAccountCardProps {
  /** Runs once the account is gone. Defaults to a full page load of `/login`, which also drops
   * everything the old session left in memory. */
  onDeleted?: () => void;
}

function goToLogin(): void {
  window.location.assign("/login");
}

function errorMessage(error: unknown): string {
  if (error instanceof DeleteAccountError) {
    if (error.code === "INVALID_CREDENTIALS") return "That password is not correct.";
    if (error.status === 401) return "Your session has ended. Sign in again to delete your account.";
    if (error.status === 429) return "Too many attempts. Please wait a while and try again.";
  }
  return "Your account could not be deleted. Please try again.";
}

/** The provider keys of the deleted account must not stay behind in this browser. */
function forgetApiKeys(userId: string): void {
  for (const provider of PROVIDERS) {
    removeStoredApiKey(userId, provider);
    removeSessionApiKey(userId, provider);
  }
}

/**
 * "Delete account" on the settings page: a confirmation dialog asks for the password again and
 * sends `DELETE /auth/me`, which erases the account and everything it owns and ends the
 * session. Then the user's keys and cached data are dropped and they are sent to sign in.
 */
export function DeleteAccountCard({ onDeleted = goToLogin }: DeleteAccountCardProps) {
  const { userId } = useCurrentUserId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordMissing, setPasswordMissing] = useState(false);
  const passwordId = useId();
  const headingId = useId();

  const removal = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      if (userId) forgetApiKeys(userId);
      queryClient.clear();
      onDeleted();
    },
  });

  if (!userId) {
    return null;
  }

  function changeOpen(next: boolean) {
    if (removal.isPending) return;
    setOpen(next);
    if (!next) {
      setPassword("");
      setPasswordMissing(false);
      removal.reset();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setPasswordMissing(true);
      return;
    }
    setPasswordMissing(false);
    removal.mutate(password);
  }

  const error = passwordMissing ? "Enter your password." : removal.isError ? errorMessage(removal.error) : null;

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <Card className="border-destructive/50">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1.5">
            <h2 id={headingId} className="text-lg font-semibold leading-none tracking-tight">
              Delete account
            </h2>
            <CardDescription>
              Permanently deletes your account, your chats and everything in them. This cannot be undone.
            </CardDescription>
          </div>
          <Button className="shrink-0" onClick={() => changeOpen(true)} type="button" variant="destructive">
            Delete account
          </Button>
        </CardHeader>
      </Card>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your account, your chats with their messages and files, and your place in chats shared with you are
              deleted for good. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <Input
                aria-describedby={error ? `${passwordId}-error` : undefined}
                autoComplete="current-password"
                id={passwordId}
                invalid={Boolean(error)}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              {error ? (
                <p id={`${passwordId}-error`} role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2">
              <Button disabled={removal.isPending} onClick={() => changeOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button loading={removal.isPending} type="submit" variant="destructive">
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
