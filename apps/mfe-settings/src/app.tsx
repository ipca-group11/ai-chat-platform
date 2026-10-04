import { H1 } from "@app/ui";
import { DeleteAccountCard } from "./features/account";
import { ProviderList } from "./features/api-keys";

/**
 * Root content of the `/settings` page (AC-75). Mounted directly by the shell as the
 * `/settings` route's component (via `createRemoteRoute('settings', () =>
 * import('mfeSettings/routes'))`, see docs/pods/shell/PLAN.md FE-2) inside the shell's
 * shared `QueryClientProvider` — this component intentionally does not create its own
 * `QueryClient` so TanStack Query state is shared with the rest of the app per
 * docs/ARCHITECTURE.md §4. For standalone dev/preview, `main.tsx` wraps this in a local
 * `QueryClientProvider` instead.
 */
export default function App() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <section aria-label="LLM provider API keys">
        <header className="space-y-2">
          <H1 className="text-3xl lg:text-3xl font-bold">LLM Provider API Keys</H1>
          <div className="typeset typeset-page max-w-2xl text-muted-foreground">
            <p>
              Configure the API key each LLM provider needs before you can chat with it. Keys
              are stored only in this browser and are never sent anywhere except once per
              request to the conversation service, when you send a chat message or test a
              connection.
            </p>
          </div>
        </header>
        <ProviderList />
      </section>
      <DeleteAccountCard />
    </div>
  );
}
