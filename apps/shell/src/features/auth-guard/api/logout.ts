import { apiFetch } from '../../../shared/http/apiClient';

/** `POST /auth/logout`: auth-service revokes the refresh token and clears the cookies. */
export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}
