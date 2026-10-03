import type { Provider } from "@app/shared-types/api-keys";
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
export declare function TestConnectionButton({ provider, apiKey, providerLabel }: TestConnectionButtonProps): import("react").JSX.Element;
