/**
 * Root content of the `/settings` page (AC-75). Mounted directly by the shell as the
 * `/settings` route's component (via `createRemoteRoute('settings', () =>
 * import('mfeSettings/routes'))`, see docs/pods/shell/PLAN.md FE-2) inside the shell's
 * shared `QueryClientProvider` — this component intentionally does not create its own
 * `QueryClient` so TanStack Query state is shared with the rest of the app per
 * docs/ARCHITECTURE.md §4. For standalone dev/preview, `main.tsx` wraps this in a local
 * `QueryClientProvider` instead.
 */
export default function App(): import("react").JSX.Element;
