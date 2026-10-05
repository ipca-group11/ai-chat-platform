import { maskStoredApiKey, type StoredApiKeyRecord } from "@app/shared-types/api-keys";
import { InlineCode, Muted } from "@app/ui";

export interface MaskedKeyDisplayProps {
  record: StoredApiKeyRecord | null;
}

/**
 * Shows a saved key masked (e.g. `••••a1b2`, last 4 chars only) — the full value is
 * never rendered again after initial entry (AC-84).
 */
export function MaskedKeyDisplay({ record }: MaskedKeyDisplayProps) {
  if (!record) {
    return <Muted data-testid="masked-key-empty">No key configured</Muted>;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span data-testid="masked-key-label" className="text-muted-foreground">Current key</span>
      <InlineCode data-testid="masked-key">{maskStoredApiKey(record)}</InlineCode>
    </div>
  );
}
