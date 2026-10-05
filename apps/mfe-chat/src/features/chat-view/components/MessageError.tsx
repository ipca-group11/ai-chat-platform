import { Alert, AlertDescription, AlertTitle, Button } from "@app/ui";
import { CircleAlert, RotateCw } from "lucide-react";
import type { Message } from "../../../shared/types";

export interface MessageErrorProps {
  message: Message;
  onRetry: (messageId: string) => void;
  retrying?: boolean;
}

/**
 * AC-72: surfaces a provider error/timeout/rate-limit to the user without crashing the chat.
 * AC-73: lets the user retry a message that failed due to a provider error.
 */
export function MessageError({ message, onRetry, retrying }: MessageErrorProps) {
  if (message.status !== "failed") return null;

  return (
    <Alert variant="destructive" data-testid={`message-error-${message.id}`}>
      <CircleAlert />
      <AlertTitle data-testid="message-error-title">Response failed</AlertTitle>
      <AlertDescription>
        <p data-testid="message-error-text">{message.error || "The provider could not complete this response."}</p>
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => onRetry(message.id)} loading={retrying}>
          {retrying ? null : <RotateCw aria-hidden="true" />}
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
