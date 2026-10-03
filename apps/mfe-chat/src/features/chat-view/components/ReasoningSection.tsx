import { useState } from "react";
import { cn } from "@app/ui";
import { Brain, ChevronRight } from "lucide-react";

export interface ReasoningSectionProps {
  reasoning: string;
  /** The model is still thinking: no answer text has arrived yet. */
  thinking: boolean;
}

/**
 * The model's reasoning above its answer. Expanded while the model is still thinking,
 * so there is something to read during the wait, and collapsed once the answer starts
 * — unless the user opened or closed it themselves.
 */
export function ReasoningSection({ reasoning, thinking }: ReasoningSectionProps) {
  const [userOpen, setUserOpen] = useState<boolean>();
  const open = userOpen ?? thinking;

  return (
    <div className="min-w-0 text-sm">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden="true" />
        <Brain className="size-3.5" aria-hidden="true" />
        {thinking ? <span className="animate-pulse">Thinking…</span> : "Thinking"}
      </button>
      {open ? (
        <div
          role="region"
          aria-label="Model reasoning"
          className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground"
        >
          {reasoning}
        </div>
      ) : null}
    </div>
  );
}
