import { Alert, AlertDescription, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@app/ui";
import { useApiKeys } from "../hooks/useApiKeys";
import { useCurrentUserId } from "../hooks/useCurrentUserId";
import { PROVIDER_NO_KEY_DESCRIPTIONS, providerLabel } from "../model/providerMeta";
import { ApiKeyForm } from "./ApiKeyForm";
import { MaskedKeyDisplay } from "./MaskedKeyDisplay";

/**
 * Lists every supported provider (OpenAI, Anthropic, Ollama) with its key management
 * UI (US-23, US-24, AC-76, AC-77): OpenAI/Anthropic show a masked key display plus an
 * add/update/remove form, Ollama shows a static "no API key required" state with no
 * input. Keys are namespaced to the current user (AC-78, AC-80).
 */
export function ProviderList() {
  const { userId, isLoading, isError } = useCurrentUserId();
  const { providers, saveKey, removeKey } = useApiKeys(userId);

  if (isLoading) {
    return (
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Loading your account…</span>
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (isError || !userId) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertDescription>Sign in to manage your LLM provider API keys.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div aria-label="Provider list" data-testid="provider-list" className="mt-8 grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
      {providers.map(({ provider, requiresKey, record, usableThisSession }) => {
        const label = providerLabel(provider);
        return (
          <Card key={provider} data-testid={`provider-card-${provider}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle data-testid="provider-name" className="text-lg">{label}</CardTitle>
                {requiresKey ? (
                  <Badge data-testid="provider-badge" variant={usableThisSession ? "success" : "outline"}>
                    {usableThisSession ? "Configured" : record ? "Re-enter key" : "Not configured"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Local</Badge>
                )}
              </div>
              <CardDescription>
                {requiresKey
                  ? `Used when a chat runs on ${label} models.`
                  : (PROVIDER_NO_KEY_DESCRIPTIONS[provider] ?? "No API key required.")}
              </CardDescription>
            </CardHeader>
            {requiresKey ? (
              <CardContent className="space-y-4">
                <MaskedKeyDisplay record={record} />
                {record && !usableThisSession ? (
                  <Alert data-testid="reenter-key-notice">
                    <AlertDescription>
                      Keys are only kept for this browser tab session. Enter the key again to use it in chats.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <ApiKeyForm
                  hasKey={record !== null}
                  onRemove={() => removeKey(provider)}
                  onSave={(rawKey) => saveKey(provider, rawKey)}
                  provider={provider}
                  providerLabel={label}
                />
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
