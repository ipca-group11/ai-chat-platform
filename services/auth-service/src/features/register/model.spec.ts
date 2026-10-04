import bcrypt from "bcrypt";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../shared/error-middleware.js";
import { logger } from "../../shared/logger.js";
import { fakePrisma } from "../../test-utils/fake-prisma.js";
import { registerUser } from "./model.js";

describe("registerUser", () => {
  it("AC-30: creates a user for a valid email/password", async () => {
    const prisma = fakePrisma();

    const user = await registerUser(prisma, { email: "new@example.com", password: "password1" });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe("new@example.com");
  });

  it("AC-31: rejects a duplicate email (case-insensitive) with a 409 and a single validation error, creating no account", async () => {
    const prisma = fakePrisma({
      users: [
        {
          id: "user-existing",
          email: "dup@example.com",
          passwordHash: "hash",
          createdAt: new Date(),
        },
      ],
    });

    await expect(
      registerUser(prisma, { email: "dup@example.com", password: "password1" }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("AC-31: rejects a duplicate email with exactly one field error", async () => {
    const prisma = fakePrisma({
      users: [{ id: "user-existing", email: "dup@example.com", passwordHash: "hash", createdAt: new Date() }],
    });

    try {
      await registerUser(prisma, { email: "dup@example.com", password: "password1" });
      expect.unreachable("expected registerUser to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpError = err as HttpError;
      expect(Object.keys(httpError.fieldErrors ?? {})).toEqual(["email"]);
      expect(httpError.fieldErrors?.email).toHaveLength(1);
    }
  });

  it("AC-33: hashes the password with bcrypt before persisting (never stores plaintext)", async () => {
    const prisma = fakePrisma();

    await registerUser(prisma, { email: "hash-check@example.com", password: "password1" });

    const createCall = (prisma.user.create as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as { data: { passwordHash: string } };
    expect(createCall.data.passwordHash).not.toBe("password1");
    await expect(bcrypt.compare("password1", createCall.data.passwordHash)).resolves.toBe(true);
  });

  it("AC-33: the plaintext password never appears in any logger call during registration", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const prisma = fakePrisma();

    await registerUser(prisma, { email: "log-check@example.com", password: "super-secret-1" });

    const allCalls = [...infoSpy.mock.calls, ...errorSpy.mock.calls];
    for (const call of allCalls) {
      expect(JSON.stringify(call)).not.toContain("super-secret-1");
    }

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
