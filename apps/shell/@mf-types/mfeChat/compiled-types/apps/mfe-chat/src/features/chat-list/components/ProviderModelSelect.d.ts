import { type Provider } from "../../../shared/types";
export interface ProviderModelSelectProps {
    provider: Provider;
    model: string;
    onChange: (next: {
        provider: Provider;
        model: string;
    }) => void;
    disabled?: boolean;
}
/**
 * Provider + model picker used by the create/edit chat dialog (US-15).
 * AC-48: user chooses provider and model when creating or editing a chat.
 * Changing provider resets the model to that provider's first supported model,
 * so the pair persisted (AC-49) is always internally consistent.
 */
export declare function ProviderModelSelect({ provider, model, onChange, disabled }: ProviderModelSelectProps): import("react").JSX.Element;
