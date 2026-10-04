import { describe, expect, it } from "vitest";
import { attachmentParamsSchema } from "./schema.js";

describe("attachmentParamsSchema", () => {
  it("accepts chat and message ids", () => {
    expect(attachmentParamsSchema.parse({ chatId: "c1", messageId: "m1" })).toEqual({ chatId: "c1", messageId: "m1" });
  });

  it("accepts a chat id alone, for an upload made before the message is sent (AICHAT-245)", () => {
    expect(attachmentParamsSchema.parse({ chatId: "c1" })).toEqual({ chatId: "c1" });
  });

  it.each([{ chatId: "", messageId: "m1" }, { chatId: "c1", messageId: "" }, { messageId: "m1" }])("rejects %j", (value) => {
    expect(attachmentParamsSchema.safeParse(value).success).toBe(false);
  });
});
