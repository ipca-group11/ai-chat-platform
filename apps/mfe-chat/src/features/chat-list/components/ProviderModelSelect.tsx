import { useId } from "react";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui";
import { PROVIDER_MODELS, PROVIDERS, type Provider } from "../../../shared/types";

export interface ProviderModelSelectProps {
  provider: Provider;
  model: string;
  onChange: (next: { provider: Provider; model: string }) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/**
 * Provider + model picker used by the create/edit chat dialog (US-15).
 * AC-48: user chooses provider and model when creating or editing a chat.
 * Changing provider resets the model to that provider's first supported model,
 * so the pair persisted (AC-49) is always internally consistent.
 */
export function ProviderModelSelect({ provider, model, onChange, disabled }: ProviderModelSelectProps) {
  const id = useId();
  const models = PROVIDER_MODELS[provider];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-provider`}>Provider</Label>
        <Select
          value={provider}
          items={PROVIDER_LABELS}
          disabled={disabled}
          onValueChange={(value) => {
            const nextProvider = value as Provider;
            const nextModel = PROVIDER_MODELS[nextProvider][0] ?? "";
            onChange({ provider: nextProvider, model: nextModel });
          }}
        >
          <SelectTrigger id={`${id}-provider`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-model`}>Model</Label>
        <Select
          value={model}
          disabled={disabled}
          onValueChange={(value) => onChange({ provider, model: value as string })}
        >
          <SelectTrigger id={`${id}-model`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
