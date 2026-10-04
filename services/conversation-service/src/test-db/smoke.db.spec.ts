import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma-client/index.js";

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

describe("Testcontainers Postgres (conversation schema)", () => {
  it("has the schema applied by prisma db push", async () => {
    const chat = await prisma.chat.create({
      data: { ownerId: "u1", title: "t", provider: "openai", model: "m", messages: { create: { ownerId: "u1", role: "user", content: "hi" } } },
    });
    await prisma.chat.delete({ where: { id: chat.id } });
    expect(await prisma.message.count()).toBe(0); // the cascade ran in a real database
  });
});
