/**
 * In-memory fake Prisma client shared by every auth-service test (register, session and
 * the full-app suite). Supports the calls the service makes: `user.findUnique` (by email
 * or id), `user.create` and `refreshToken.findUnique/create/update`. No database.
 */
import bcrypt from "bcrypt";
import type { PrismaClient } from "../generated/prisma-client/index.js";
import { vi } from "vitest";

export interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string;
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

export async function makeUser(email: string, password: string): Promise<FakeUserRow> {
  return {
    id: `user-${email}`,
    email,
    passwordHash: await bcrypt.hash(password, 4),
    createdAt: new Date(),
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
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return users.get(where.email) ?? null;
        if (where.id) return usersById.get(where.id) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: { data: { email: string; passwordHash: string } }) => {
        const user: FakeUserRow = {
          id: `user-${nextUserId++}`,
          email: data.email,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
        };
        users.set(user.email, user);
        usersById.set(user.id, user);
        return user;
      }),
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
  const failing = { findUnique: vi.fn(() => Promise.reject(error)), create: vi.fn(() => Promise.reject(error)), update: vi.fn(() => Promise.reject(error)) };
  return { user: failing, refreshToken: failing } as unknown as PrismaClient;
}
