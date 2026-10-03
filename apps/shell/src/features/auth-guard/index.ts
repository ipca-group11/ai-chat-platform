// Public API of the `auth-guard` feature (per docs/pods/shell/PLAN.md). Other
// features/routes must only import from this module, not from `auth-guard`'s
// internal folders.
export { useSession } from './api/useSession';
export type { UseSessionResult } from './api/useSession';
export { RequireAuth } from './components/RequireAuth';
export type { RequireAuthProps } from './components/RequireAuth';
export type { Session, AuthMeResponse } from './model/session';
