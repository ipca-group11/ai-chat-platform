import { describe, expect, it } from "vitest";
import { attachmentParamsSchema } from "./schema.js";

describe("attachmentParamsSchema", () => {
  it("accepts chat and message ids", () => {
    expect(attachmentParamsSchema.parse({ chatId: "c1", messageId: "m1" })).toEqual({ chatId: "c1", messageId: "m1" });
  });

  it.each([{ chatId: "", messageId: "m1" }, { chatId: "c1", messageId: "" }, { chatId: "c1" }])("rejects %j", (value) => {
    expect(attachmentParamsSchema.safeParse(value).success).toBe(false);
  });
});
