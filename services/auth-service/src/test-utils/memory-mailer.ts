import type { EmailVerificationMessage, Mailer } from "../shared/mailer.js";

/** A `Mailer` that keeps every message, so a test can read the token a user would receive. */
export class MemoryMailer implements Mailer {
  readonly sent: EmailVerificationMessage[] = [];

  async sendEmailVerification(message: EmailVerificationMessage): Promise<void> {
    this.sent.push(message);
  }

  /** The newest token sent to `email`; throws when there is none. */
  tokenFor(email: string): string {
    const message = this.sent.findLast((m) => m.email === email);
    if (!message) throw new Error(`no verification email sent to ${email}`);
    return message.token;
  }
}
