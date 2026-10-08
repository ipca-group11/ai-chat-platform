import type { Provider } from "@app/shared-types/api-keys";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@app/ui";
import { testConnection } from "../api/testConnection";

export interface TestConnectionButtonProps {
  provider: Provider;
  /** The (unsaved or just-saved) raw key value to test with; never persisted. */
  apiKey: string;
  providerLabel: string;
}

/**
 * "Test connection" action (AC-85): sends `apiKey` once to `conversation-service` via
 * the shared test-connection contract and shows a success/failure message with a clear
 * failure reason. Disabled when there's no key to test with.
 */
export function TestConnectionButton({ provider, apiKey, providerLabel }: TestConnectionButtonProps) {
  const mutation = useMutation({
    mutationFn: () => testConnection(provider, apiKey),
  });

  const disabled = apiKey.trim().length === 0 || mutation.isPending;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        data-testid="test-connection"
        disabled={disabled}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Testing…" : `Test ${providerLabel} connection`}
      </Button>

      {mutation.isSuccess && mutation.data.success ? (
        <Alert variant="success" role="status" data-testid="test-connection-success">
          <AlertDescription className="text-success">Connection successful.</AlertDescription>
        </Alert>
      ) : null}

      {mutation.isSuccess && !mutation.data.success ? (
        <Alert variant="destructive" data-testid="test-connection-error">
          <AlertDescription>{mutation.data.message ?? "Connection failed."}</AlertDescription>
        </Alert>
      ) : null}

      {mutation.isError ? (
        <Alert variant="destructive" data-testid="test-connection-error">
          <AlertDescription>Unable to test the connection. Please try again.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
