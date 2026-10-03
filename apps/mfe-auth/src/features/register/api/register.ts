import { apiFetch } from "../../../shared/api-client";
import type { RegisterInput } from "../model";

export interface RegisterResponse {
  id: string;
  email: string;
}

// POST /auth/register — contract owned by `services/auth-service` (PLAN.md B2).
export function registerUser(input: RegisterInput): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
}
