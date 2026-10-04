import { describe, expect, it } from "vitest";
import { eraseUserSchema } from "./schema.js";

describe("eraseUserSchema", () => {
  it("accepts a user id and an email", () => {
    expect(eraseUserSchema.parse({ userId: "u1", email: "u1@example.com" })).toEqual({ userId: "u1", email: "u1@example.com" });
  });

  it.each([{}, { userId: "", email: "u1@example.com" }, { userId: "u1", email: "nope" }, { userId: "u1" }])("rejects %j", (body) => {
    expect(eraseUserSchema.safeParse(body).success).toBe(false);
  });
});
