import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { newConsumerPact, runWithMockServer } from "@platform/pact-config";
import { describe, expect, it } from "vitest";
import { CHAT_ID, attachmentBody, correlation } from "../../../test/pact";
import { uploadAttachment } from "./useUploadAttachment";

// Contract mfe-chat -> conversation-service: attachment upload (AICHAT-179). Written as the
// client sends it today; conversation-service has no such route (AICHAT-255), so provider
// verification lists this interaction as a known failure until that is fixed.
const pact = newConsumerPact("mfe-chat", "conversation-service");
const fixture = fileURLToPath(new URL("../../../test/fixtures/notes.txt", import.meta.url));

describe("mfe-chat -> conversation-service: attachments", () => {
  it("POST /chats/:id/attachments uploads a file as multipart field `file` (201)", async () => {
    pact
      .given("a user owns a chat", { chatId: CHAT_ID })
      .uponReceiving("a multipart upload of a text file")
      .withRequestMultipartFileUpload(
        { method: "POST", path: `/chats/${CHAT_ID}/attachments`, headers: correlation },
        "text/plain",
        fixture,
        "file",
      )
      .willRespondWith({ status: 201, headers: correlation, body: { attachment: attachmentBody } });

    const file = new File([readFileSync(fixture)], "notes.txt", { type: "text/plain" });

    await expect(runWithMockServer(pact, () => uploadAttachment(CHAT_ID, file), { stripPrefix: "/api" })).resolves.toMatchObject({
      filename: "notes.txt",
      kind: "text",
    });
  });
});
