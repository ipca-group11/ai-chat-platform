import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_VERIFICATION_TTL_SECONDS } from "../../shared/contracts/auth.js";
import { fakePrisma, makeUser } from "../../test-utils/fake-prisma.js";
import { MemoryMailer } from "../../test-utils/memory-mailer.js";
import { sendVerificationEmail, verifyEmail } from "./model.js";

afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const user = await makeUser("ana@example.com", "password1");
  const prisma = fakePrisma({ users: [user] });
  const mailer = new MemoryMailer();
  return { user, prisma, mailer };
}

describe("sendVerificationEmail", () => {
  it("stores the SHA-256 of a fresh token with a 24 h expiry and mails the token itself", async () => {
    const { user, prisma, mailer } = await setup();
    const before = Date.now();
    await sendVerificationEmail(prisma, mailer, user);

    const token = mailer.tokenFor("ana@example.com");
    const data = prisma.emailVerificationToken.create.mock.calls[0]?.[0].data;
    expect(data?.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(data?.userId).toBe(user.id);
    expect(data?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + EMAIL_VERIFICATION_TTL_SECONDS * 1000);
    expect(mailer.sent[0]?.expiresAt).toEqual(data?.expiresAt);
  });

  it("replaces the pending token instead of adding another", async () => {
    const { user, prisma, mailer } = await setup();
    await sendVerificationEmail(prisma, mailer, user);
    await sendVerificationEmail(prisma, mailer, user);
    expect(prisma.__verificationTokenCount(user.id)).toBe(1);
    expect(mailer.sent[0]?.token).not.toBe(mailer.sent[1]?.token);
  });
});

describe("verifyEmail", () => {
  it("marks the user verified with a timestamp and spends the token", async () => {
    const { user, prisma, mailer } = await setup();
    await sendVerificationEmail(prisma, mailer, user);

    await expect(verifyEmail(prisma, mailer.tokenFor("ana@example.com"))).resolves.toEqual({ userId: user.id });
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(prisma.__verificationTokenCount(user.id)).toBe(0);
  });

  it("rejects an unknown token with 400 INVALID_VERIFICATION_TOKEN", async () => {
    const { prisma } = await setup();
    await expect(verifyEmail(prisma, "0".repeat(64))).rejects.toMatchObject({ status: 400, code: "INVALID_VERIFICATION_TOKEN" });
  });

  it("rejects an expired token and leaves the user unverified", async () => {
    const { user, prisma, mailer } = await setup();
    await sendVerificationEmail(prisma, mailer, user);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (EMAIL_VERIFICATION_TTL_SECONDS + 1) * 1000);

    await expect(verifyEmail(prisma, mailer.tokenFor("ana@example.com"))).rejects.toMatchObject({ status: 400 });
    expect(user.emailVerified).toBe(false);
  });
});
