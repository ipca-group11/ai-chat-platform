import { type StoredApiKeyRecord } from "@app/shared-types/api-keys";
export interface MaskedKeyDisplayProps {
    record: StoredApiKeyRecord | null;
}
/**
 * Shows a saved key masked (e.g. `••••a1b2`, last 4 chars only) — the full value is
 * never rendered again after initial entry (AC-84).
 */
export declare function MaskedKeyDisplay({ record }: MaskedKeyDisplayProps): import("react").JSX.Element;
