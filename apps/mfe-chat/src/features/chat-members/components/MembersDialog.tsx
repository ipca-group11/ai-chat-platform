import { useState } from "react";
import { Alert, AlertDescription, Badge, Button, Input, Label, Skeleton } from "@app/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/dialog";
import { UserPlus, X } from "lucide-react";
import { useAddChatMember, useChatMembers, useLeaveChat, useRemoveChatMember } from "../api/members";

export interface MembersDialogProps {
  chatId: string;
  chatTitle: string;
  /** Owners can invite and remove; members can only view the list and leave. */
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
  /** Called after the current user left the chat, so the page can navigate away. */
  onLeft?: () => void;
}

/** Lists who has access to a chat; the owner invites people by email. */
export function MembersDialog({ chatId, chatTitle, isOwner, open, onClose, onLeft }: MembersDialogProps) {
  const [email, setEmail] = useState("");
  const membersQuery = useChatMembers(chatId, open);
  const addMember = useAddChatMember(chatId);
  const removeMember = useRemoveChatMember(chatId);
  const leaveChat = useLeaveChat(chatId);

  const error = addMember.error ?? removeMember.error ?? leaveChat.error;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* Named by its title (aria-labelledby): "Members". */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            {isOwner
              ? `Invite people to “${chatTitle}”. They can read the history and send messages using their own API keys.`
              : `People with access to “${chatTitle}”.`}
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = email.trim();
              if (!trimmed) return;
              addMember.mutate(trimmed, { onSuccess: () => setEmail("") });
            }}
          >
            <Label htmlFor="invite-email">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" loading={addMember.isPending} disabled={!email.trim()}>
                <UserPlus aria-hidden="true" />
                Invite
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        {membersQuery.isLoading ? (
          <div className="space-y-2">
            <span className="sr-only">Loading members…</span>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : membersQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Could not load members.</AlertDescription>
          </Alert>
        ) : (
          <ul aria-label="Members" className="divide-y divide-border rounded-md border border-border">
            {membersQuery.data?.map(({ email: memberEmail, role }) => (
              <li key={`${role}-${memberEmail ?? "owner"}`} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{memberEmail ?? "Chat owner"}</span>
                {role === "owner" ? (
                  <Badge variant="secondary" className="shrink-0">
                    Owner
                  </Badge>
                ) : isOwner && memberEmail ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate(memberEmail)}
                    aria-label={`Remove ${memberEmail}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2">
          {!isOwner ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              loading={leaveChat.isPending}
              onClick={() => leaveChat.mutate(undefined, { onSuccess: () => onLeft?.() })}
            >
              Leave chat
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
