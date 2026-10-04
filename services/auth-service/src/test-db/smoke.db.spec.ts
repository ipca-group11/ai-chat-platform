import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma-client/index.js";

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

describe("Testcontainers Postgres (auth schema)", () => {
  it("has the schema applied by prisma db push", async () => {
    const user = await prisma.user.create({ data: { email: "smoke@example.test", passwordHash: "x" } });
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: "smoke", expiresAt: new Date() } });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0); // the cascade ran in a real database
  });
});
