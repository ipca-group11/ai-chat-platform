/**
 * Lists every supported provider (OpenAI, Anthropic, Ollama) with its key management
 * UI (US-23, US-24, AC-76, AC-77): OpenAI/Anthropic show a masked key display plus an
 * add/update/remove form, Ollama shows a static "no API key required" state with no
 * input. Keys are namespaced to the current user (AC-78, AC-80).
 */
export declare function ProviderList(): import("react").JSX.Element;
