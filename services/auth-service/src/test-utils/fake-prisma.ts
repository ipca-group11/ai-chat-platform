/**
 * In-memory fake Prisma client shared by every auth-service test (register, session and
 * the full-app suite). Supports the calls the service makes: `user.findUnique` (by email
 * or id), `user.create`, `refreshToken.findUnique/create/update` and `emailVerificationToken.findUnique/create/deleteMany`. No database.
 */
import { hashPassword } from "../shared/password.js";
import type { PrismaClient } from "../generated/prisma-client/index.js";
import { vi } from "vitest";

export interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  lastActiveAt: Date;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
}

export interface FakeVerificationTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface FakeRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFrom: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export async function makeUser(email: string, password: string, options: { emailVerified?: boolean } = {}): Promise<FakeUserRow> {
  const emailVerified = options.emailVerified ?? false;
  return {
    id: `user-${email}`,
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
    lastActiveAt: new Date(),
    emailVerified,
    emailVerifiedAt: emailVerified ? new Date() : null,
  };
}

export function fakePrisma(seed: { users?: FakeUserRow[]; refreshTokens?: FakeRefreshTokenRow[] } = {}) {
  const users = new Map<string, FakeUserRow>();
  const usersById = new Map<string, FakeUserRow>();
  for (const user of seed.users ?? []) {
    users.set(user.email, user);
    usersById.set(user.id, user);
  }
  const tokens = new Map<string, FakeRefreshTokenRow>();
  const tokensById = new Map<string, FakeRefreshTokenRow>();
  let nextTokenId = 1;
  let nextUserId = 1;
  let nextVerificationId = 1;
  const verificationTokens = new Map<string, FakeVerificationTokenRow>();
  const dropVerificationTokens = (userId: string) => {
    let count = 0;
    for (const [hash, row] of verificationTokens) {
      if (row.userId === userId) {
        verificationTokens.delete(hash);
        count++;
      }
    }
    return count;
  };
  for (const token of seed.refreshTokens ?? []) {
    tokens.set(token.tokenHash, token);
    tokensById.set(token.id, token);
  }

  const prisma = {
    /** Test-only seeding helper, not part of the real `PrismaClient` API. */
    __addUser(user: FakeUserRow) {
      users.set(user.email, user);
      usersById.set(user.id, user);
    },
    /** Test-only: deletes a user, e.g. to simulate an account removed after login. */
    __removeUser(id: string) {
      const user = usersById.get(id);
      if (!user) return;
      usersById.delete(id);
      users.delete(user.email);
    },
    /** Test-only: how many email verification tokens a user has pending. */
    __verificationTokenCount(userId: string) {
      return [...verificationTokens.values()].filter((t) => t.userId === userId).length;
    },
    /** Test-only: how many refresh tokens a user still has. */
    __tokenCount(userId: string) {
      return [...tokens.values()].filter((t) => t.userId === userId).length;
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return users.get(where.email) ?? null;
        if (where.id) return usersById.get(where.id) ?? null;
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUserRow> }) => {
        const user = usersById.get(where.id);
        if (!user) throw new Error("not found");
        Object.assign(user, data);
        return user;
      }),
      /** Deletes the matching user and, like the `onDelete: Cascade` of the schema, their refresh tokens. */
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        const user = usersById.get(where.id);
        if (!user) return { count: 0 };
        usersById.delete(user.id);
        users.delete(user.email);
        dropVerificationTokens(user.id);
        for (const [hash, token] of tokens) {
          if (token.userId === user.id) {
            tokens.delete(hash);
            tokensById.delete(token.id);
          }
        }
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: { data: { email: string; passwordHash: string } }) => {
        const user: FakeUserRow = {
          id: `user-${nextUserId++}`,
          email: data.email,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          emailVerified: false,
          emailVerifiedAt: null,
        };
        users.set(user.email, user);
        usersById.set(user.id, user);
        return user;
      }),
    },
    emailVerificationToken: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => verificationTokens.get(where.tokenHash) ?? null),
      create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row: FakeVerificationTokenRow = { id: `verification-${nextVerificationId++}`, createdAt: new Date(), ...data };
        verificationTokens.set(row.tokenHash, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => ({ count: dropVerificationTokens(where.userId) })),
    },
    refreshToken: {
      findUnique: vi.fn(
        async ({ where }: { where: { tokenHash: string }; include?: { user: boolean } }) => {
          const row = tokens.get(where.tokenHash);
          if (!row) return null;
          return { ...row, user: usersById.get(row.userId) };
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { userId: string; tokenHash: string; expiresAt: Date; rotatedFrom?: string };
        }) => {
          const row: FakeRefreshTokenRow = {
            id: `token-${nextTokenId++}`,
            userId: data.userId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            rotatedFrom: data.rotatedFrom ?? null,
            revokedAt: null,
            createdAt: new Date(),
          };
          tokens.set(row.tokenHash, row);
          tokensById.set(row.id, row);
          return row;
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeRefreshTokenRow>;
        }) => {
          const row = tokensById.get(where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };

  return prisma as unknown as PrismaClient & typeof prisma;
}

/** A Prisma stand-in whose every operation rejects with an unexpected error, to drive the
 * "unexpected failure -> safe 500" paths. */
export function throwingPrisma(error: Error = new Error("database exploded: secret-internal-detail")): PrismaClient {
  const failing = {
    findUnique: vi.fn(() => Promise.reject(error)),
    create: vi.fn(() => Promise.reject(error)),
    update: vi.fn(() => Promise.reject(error)),
    deleteMany: vi.fn(() => Promise.reject(error)),
  };
  return { user: failing, refreshToken: failing, emailVerificationToken: failing } as unknown as PrismaClient;
}
