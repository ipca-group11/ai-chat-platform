import { z } from "zod";

// Password/email policy (STACK.md decision #4): minimum 8 characters, at least one
// letter and one number.
//
// TODO(platform): this schema is expected to live in `packages/shared-types` so
// `auth-service` and `mfe-auth` share exactly one definition. This is a local fallback
// used until that package lands; keep the rules in sync with
// `services/auth-service/src/features/register/model.ts` in the meantime, then switch
// this module to re-export from `@repo/shared-types`.

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Login only validates that fields are present; the server is the source of truth for
// whether credentials are correct, per AC-36 (one generic error, no client-side
// guessing of which field was wrong).
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
