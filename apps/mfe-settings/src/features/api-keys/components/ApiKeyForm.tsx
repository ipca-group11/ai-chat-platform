import type { Provider } from "@app/shared-types/api-keys";
import { type FormEvent, useState } from "react";
import { Button, Input, Label } from "@app/ui";
import { TestConnectionButton } from "./TestConnectionButton";

export interface ApiKeyFormProps {
  provider: Provider;
  providerLabel: string;
  hasKey: boolean;
  onSave: (rawKey: string) => void;
  onRemove: () => void;
}

/**
 * Add/update/remove form for a single provider's API key (US-23, AC-76). Only the raw
 * key typed here is ever available in memory — `onSave` hands it to the shared storage
 * helper, which persists only the last 4 characters (AC-78, AC-79); this component
 * itself never re-displays a previously saved raw value (AC-84 — see
 * `MaskedKeyDisplay`, rendered alongside this form by `ProviderList`).
 */
export function ApiKeyForm({ provider, providerLabel, hasKey, onSave, onRemove }: ApiKeyFormProps) {
  const [rawKey, setRawKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = rawKey.trim();
    if (!trimmed) {
      setError("API key is required.");
      return;
    }
    setError(null);
    onSave(trimmed);
    setRawKey("");
  }

  const inputId = `${provider}-api-key`;

  return (
    <div className="space-y-3">
      <form aria-label={`${providerLabel} API key form`} className="space-y-3" noValidate onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor={inputId}>{providerLabel} API key</Label>
          <Input
            aria-describedby={error ? `${inputId}-error` : undefined}
            autoComplete="off"
            id={inputId}
            invalid={Boolean(error)}
            onChange={(event) => setRawKey(event.target.value)}
            placeholder={hasKey ? "Enter a new key to update" : "Enter your API key"}
            type="password"
            value={rawKey}
          />
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {hasKey ? "Update key" : "Save key"}
          </Button>
          {hasKey ? (
            <Button onClick={onRemove} size="sm" type="button" variant="ghost" className="text-destructive hover:text-destructive">
              Remove key
            </Button>
          ) : null}
        </div>
      </form>

      <TestConnectionButton apiKey={rawKey} provider={provider} providerLabel={providerLabel} />
    </div>
  );
}
