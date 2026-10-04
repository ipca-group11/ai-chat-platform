import { z } from "zod";
import { passwordSchema } from "./password-policy";

/** Request body for `POST /auth/register` (FR1, UC1). */
export const registerRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** Request body for `POST /auth/login` (FR2, UC2). */
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Request body for `DELETE /auth/me`: the password is asked again before the account and
 * everything it owns are erased (GDPR Art. 17). Same limits as auth-service's contract.
 */
export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

/** Public user profile shape returned by `auth-service` (never includes the password hash). */
export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * Response body for register/login/me. Access and refresh tokens are set as httpOnly
 * cookies (ARCHITECTURE.md §4) and are never included in the JSON body.
 */
export const authResponseSchema = z.object({
  user: userProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
