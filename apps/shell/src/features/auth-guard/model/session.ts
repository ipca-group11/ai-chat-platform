// TODO(integration): replace with the `Session` / `AuthMeResponse` DTO exported
// from `packages/shared-types` once `auth-service`'s contract package is
// available (see docs/pods/shell/PLAN.md, "packages/shared-types" assumption).
export interface Session {
  userId: string;
  email: string;
}

export interface AuthMeResponse {
  user: Session;
}
