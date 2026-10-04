import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { createLogMailer, createMailer, disabledMailer } from "./mailer.js";

const message = { userId: "user-1", email: "ana@example.com", token: "f".repeat(64), expiresAt: new Date("2026-10-05T12:00:00Z") };

function memoryLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { logger: createLogger(stream, "info"), lines };
}

describe("mailer (AICHAT-253)", () => {
  it("the log mailer writes the token and the user id, never the address", async () => {
    const { logger, lines } = memoryLogger();
    await createLogMailer(logger).sendEmailVerification(message);

    const line = JSON.parse(lines.join("")) as Record<string, unknown>;
    expect(line.verificationToken).toBe(message.token);
    expect(line.userId).toBe("user-1");
    expect(line.expiresAt).toBe("2026-10-05T12:00:00.000Z");
    expect(lines.join("")).not.toContain("ana@example.com");
  });

  it("the disabled mailer sends nothing and does not fail", async () => {
    await expect(disabledMailer.sendEmailVerification(message)).resolves.toBeUndefined();
  });

  it("EMAIL_DELIVERY picks the mailer: log writes, off stays silent", async () => {
    const { logger, lines } = memoryLogger();
    await createMailer("off", logger).sendEmailVerification(message);
    expect(lines).toHaveLength(0);
    await createMailer("log", logger).sendEmailVerification(message);
    expect(lines).toHaveLength(1);
  });

  it("EMAIL_DELIVERY defaults to off in production and log elsewhere, and can be set", () => {
    const base = { DATABASE_URL: "postgresql://localhost/auth", JWT_SECRET: "s" };
    expect(loadEnv({ ...base, NODE_ENV: "production" }).EMAIL_DELIVERY).toBe("off");
    expect(loadEnv({ ...base, NODE_ENV: "development" }).EMAIL_DELIVERY).toBe("log");
    expect(loadEnv({ ...base, NODE_ENV: "production", EMAIL_DELIVERY: "log" }).EMAIL_DELIVERY).toBe("log");
    expect(() => loadEnv({ ...base, EMAIL_DELIVERY: "smtp" })).toThrow();
  });
});
