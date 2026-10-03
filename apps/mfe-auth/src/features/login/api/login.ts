import { apiFetch } from "../../../shared/api-client";
import type { LoginInput } from "../model";

export interface LoginResponse {
  id: string;
  email: string;
}

// POST /auth/login — contract owned by `services/auth-service` (PLAN.md B3). On success
// the access/refresh tokens arrive as httpOnly cookies (AC-37); the response body only
// carries the user's public profile.
export function loginUser(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

// POST /auth/logout — revokes the refresh token server-side (AC-38).
export function logoutUser(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}
