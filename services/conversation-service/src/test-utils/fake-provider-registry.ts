import type { Provider } from "../shared/contracts/chat.js";
import type {
  LlmProvider,
  LlmStreamChunk,
  ProviderRegistry,
  SendMessageContext,
  SendMessageOptions,
} from "../features/llm-adapters/index.js";

export type ProviderScript = (context: SendMessageContext, options?: SendMessageOptions) => AsyncIterable<LlmStreamChunk>;

export interface FakeProviderOptions {
  id?: Provider;
  vision?: boolean;
  reasoning?: boolean;
  webFetch?: boolean;
}

/** In-memory `LlmProvider` whose `sendMessage` runs the given script (by default it
 * yields nothing). Capabilities are plain flags, so no network and no real adapter. */
export class ScriptedProvider implements LlmProvider {
  readonly id: Provider;

  constructor(
    private readonly script: ProviderScript = async function* () {},
    private readonly options: FakeProviderOptions = {},
  ) {
    this.id = options.id ?? "anthropic";
  }

  sendMessage(context: SendMessageContext, options?: SendMessageOptions): AsyncIterable<LlmStreamChunk> {
    return this.script(context, options);
  }

  supportsVision(): boolean {
    return this.options.vision ?? false;
  }

  supportsReasoning(): boolean {
    return this.options.reasoning ?? false;
  }

  supportsWebFetch(): boolean {
    return this.options.webFetch ?? false;
  }
}

export function fakeProvider(options: FakeProviderOptions = {}, script?: ProviderScript): LlmProvider {
  return new ScriptedProvider(script, options);
}

/** A `ProviderRegistry` that returns the given provider for every id, or looks it up in a
 * per-provider map. */
export function fakeProviderRegistry(
  providers: LlmProvider | Partial<Record<Provider, LlmProvider>> = fakeProvider({ vision: true }),
): ProviderRegistry {
  if ("sendMessage" in providers) {
    return { get: () => providers };
  }
  return {
    get(id: Provider): LlmProvider {
      const provider = providers[id];
      if (!provider) throw new Error(`No fake provider registered for "${id}"`);
      return provider;
    },
  };
}
