import { z } from "zod";

/**
 * Password policy (STACK.md decision #4): minimum 8 characters, at least one letter and
 * at least one number. Shared by `mfe-auth`'s form validation and `auth-service`'s
 * registration handler so both sides enforce exactly the same rule.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  })
  .regex(/[A-Za-z]/, { message: "Password must contain at least one letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

export type Password = z.infer<typeof passwordSchema>;

export function isValidPassword(value: string): boolean {
  return passwordSchema.safeParse(value).success;
}
