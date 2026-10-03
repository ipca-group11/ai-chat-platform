// Module Federation entry point exposed as `./routes` (see vite.config.ts and
// apps/shell/module-federation.config.ts). The shell loads this via
// `createRemoteRoute('settings', () => import('mfeSettings/routes'))` and mounts the
// default export directly as its `/settings` route's `component` (AC-75) — matching the
// contract already established by the `shell`/`auth` pods'
// `RemoteLoader`/`mfeAuth/routes` implementation (see
// apps/shell/src/features/remote-loader/model/loadRemote.ts:
// `() => Promise<{ default: ComponentType }>`).
//
// Note: docs/pods/configuration/PLAN.md FE-1 originally listed this file as
// `src/routes/settings.tsx`; it lives at `src/routes.tsx` instead to match the single
// `./routes` federation module convention fixed by the `shell` pod's plan (and already
// implemented the same way by `mfe-auth`), since the shell owns the `/settings`
// TanStack Router route/path itself and only needs this remote to default-export the
// page content.
export { default } from "./app";
