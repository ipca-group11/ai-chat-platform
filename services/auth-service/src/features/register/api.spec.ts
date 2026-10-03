import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();

vi.mock("../../shared/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

const { registerRouter } = await import("./api");
const { errorMiddleware } = await import("../../shared/error-middleware");
const { correlationIdMiddleware } = await import("../../shared/correlation-id");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(registerRouter);
  app.use(errorMiddleware);
  return app;
}

describe("POST /register", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it("AC-30: 201s and returns the public user profile on a valid registration", async () => {
    findUnique.mockResolvedValue(null);
    create.mockImplementation(async ({ data }: { data: { email: string; passwordHash: string } }) => ({
      id: "user-1",
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
    }));

    const res = await request(buildApp())
      .post("/register")
      .send({ email: "New@Example.com", password: "password1" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "user-1", email: "new@example.com" });
    expect(res.body.password).toBeUndefined();
  });

  it("AC-31: 409s with a single validation error on a duplicate (case-insensitive) email", async () => {
    findUnique.mockResolvedValue({
      id: "existing",
      email: "dup@example.com",
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const res = await request(buildApp())
      .post("/register")
      .send({ email: "DUP@example.com", password: "password1" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(["email"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("AC-32: 400s with a validation error when the password does not meet the policy", async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/register")
      .send({ email: "weak@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fieldErrors.password).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("AC-32: 400s when the email is missing/invalid", async () => {
    const res = await request(buildApp())
      .post("/register")
      .send({ email: "not-an-email", password: "password1" });

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.email).toBeTruthy();
  });

  it("AC-33: never echoes the plaintext password back in the response body", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      id: "user-2",
      email: "check@example.com",
      passwordHash: "hashed-value",
      createdAt: new Date(),
    });

    const res = await request(buildApp())
      .post("/register")
      .send({ email: "check@example.com", password: "password1" });

    expect(JSON.stringify(res.body)).not.toContain("password1");
    expect(JSON.stringify(res.body)).not.toContain("hashed-value");
  });
});
