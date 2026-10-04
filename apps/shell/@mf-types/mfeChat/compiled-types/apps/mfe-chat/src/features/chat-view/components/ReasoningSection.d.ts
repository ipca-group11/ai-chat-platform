export interface ReasoningSectionProps {
    reasoning: string;
    /** The model is still thinking: no answer text has arrived yet. */
    thinking: boolean;
}
/**
 * The model's reasoning above its answer. Expanded while the model is still thinking,
 * so there is something to read during the wait, and collapsed once the answer starts
 * — unless the user opened or closed it themselves.
 */
export declare function ReasoningSection({ reasoning, thinking }: ReasoningSectionProps): import("react").JSX.Element;
