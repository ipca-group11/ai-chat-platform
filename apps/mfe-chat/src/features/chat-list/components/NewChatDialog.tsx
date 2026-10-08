import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@app/ui";
import { supportsReasoning, supportsWebFetch } from "../../../shared/model-capabilities";
import type { Provider } from "../../../shared/types";
import { ProviderModelSelect } from "./ProviderModelSelect";

export interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; provider: Provider; model: string; reasoning?: boolean; webFetch?: boolean }) => void;
  submitting?: boolean;
}

/** AC-42 (create), AC-48 (provider/model chosen at creation time). */
export function NewChatDialog({ open, onClose, onCreate, submitting }: NewChatDialogProps) {
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState<Provider>("ollama");
  const [model, setModel] = useState("llama3.2:1b");
  const [reasoning, setReasoning] = useState(false);
  const canReason = supportsReasoning(provider, model);
  const [webFetch, setWebFetch] = useState(false);
  const canFetch = supportsWebFetch(provider, model);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-label="New chat" data-testid="new-chat-dialog">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>Give it a title and pick the model that will answer.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onCreate({
              title: title.trim(),
              provider,
              model,
              ...(canReason ? { reasoning } : {}),
              ...(canFetch ? { webFetch } : {}),
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="new-chat-title">Title</Label>
            <Input
              id="new-chat-title"
              aria-label="Chat title"
              data-testid="chat-title"
              placeholder="e.g. Trip planning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <ProviderModelSelect
            provider={provider}
            model={model}
            onChange={(next) => {
              setProvider(next.provider);
              setModel(next.model);
            }}
          />
          {canReason ? (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={reasoning}
                onChange={(e) => setReasoning(e.target.checked)}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">Reasoning</span>
                <span className="text-muted-foreground">The model thinks before answering: slower, but better on hard questions.</span>
              </span>
            </label>
          ) : null}
          {canFetch ? (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={webFetch}
                onChange={(e) => setWebFetch(e.target.checked)}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">Web fetch</span>
                <span className="text-muted-foreground">The model can open links you paste in the chat and read the pages.</span>
              </span>
            </label>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" data-testid="cancel-new-chat" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="create-chat" loading={submitting} disabled={!title.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
