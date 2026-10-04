/**
 * Delivery of the email verification token (AICHAT-253). The platform has no mail provider yet, so
 * delivery is pluggable:
 *
 *   - `log` (default outside production): writes the token to the service log, so a developer can
 *     copy it into `POST /auth/verify-email`. Never use it where people other than the operators
 *     can read the logs.
 *   - `off` (default in production): nothing is sent; accounts stay unverified until a real mailer
 *     is plugged in (implement `Mailer` and pass it to `createApp`).
 *
 * Tests pass their own `Mailer` that keeps the messages in memory.
 */
import type { Logger } from "./logger.js";

export interface EmailVerificationMessage {
  userId: string;
  /** The address the token proves (personal data: a mailer sends to it, it never logs it). */
  email: string;
  /** The plaintext token; only its hash is stored. */
  token: string;
  expiresAt: Date;
}

export interface Mailer {
  sendEmailVerification(message: EmailVerificationMessage): Promise<void>;
}

export type EmailDelivery = "log" | "off";

/** Writes the token to the log (development only). The address is left out: logs carry no emails. */
export function createLogMailer(logger: Logger): Mailer {
  return {
    async sendEmailVerification({ userId, token, expiresAt }) {
      logger.info(
        { userId, verificationToken: token, expiresAt: expiresAt.toISOString() },
        "email verification token (development delivery): POST /auth/verify-email with {\"token\": \"<verificationToken>\"}",
      );
    },
  };
}

/** Sends nothing; the token can only be replaced by a new one (resend) once a mailer exists. */
export const disabledMailer: Mailer = {
  async sendEmailVerification() {},
};

export function createMailer(delivery: EmailDelivery, logger: Logger): Mailer {
  return delivery === "log" ? createLogMailer(logger) : disabledMailer;
}
