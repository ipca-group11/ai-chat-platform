import { File as NodeFile } from "node:buffer";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { ApiError } from "../../../shared/api-client";
import { useUploadAttachment } from "./useUploadAttachment";

// jsdom's FormData and File are not the ones Node's fetch understands, so a multipart upload
// built from them never reaches the network layer. Use Node's own classes for these tests; the
// hook under test does not care which implementation it gets.
async function nodeFormData(): Promise<typeof FormData> {
  const sample = await new Response(new URLSearchParams("a=b")).formData();
  return sample.constructor as typeof FormData;
}

let file: File;

beforeEach(async () => {
  vi.stubGlobal("FormData", await nodeFormData());
  file = new NodeFile(["hello"], "notes.txt", { type: "text/plain" }) as unknown as File;
});

afterEach(() => vi.unstubAllGlobals());

describe("useUploadAttachment (AC-66, AC-67, AC-68, AC-71)", () => {
  it("AC-66: posts the file as multipart form data to the chat and returns the attachment", async () => {
    let received: { path: string; contentType: string | null; raw: string } | undefined;
    server.use(
      http.post("*/chats/:chatId/attachments", async ({ request }) => {
        received = {
          path: new URL(request.url).pathname,
          contentType: request.headers.get("content-type"),
          raw: await request.text(),
        };
        return HttpResponse.json({
          attachment: { id: "att-1", messageId: "m1", filename: "notes.txt", mimeType: "text/plain", size: 5, kind: "text" },
        });
      })
    );

    const { result } = renderHookWithClient(() => useUploadAttachment("chat-1"));
    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "att-1", filename: "notes.txt", kind: "text" });
    expect(received?.path).toBe("/api/chats/chat-1/attachments");
    // The browser sets the multipart boundary; the client must not force a JSON content type.
    expect(received?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(received?.raw).toContain('name="file"; filename="notes.txt"');
    expect(received?.raw).toContain("hello");
  });

  it("AC-67: surfaces the server's rejection of a file type", async () => {
    server.use(
      http.post("*/chats/:chatId/attachments", () =>
        HttpResponse.json({ error: { code: "ATTACHMENT_UPLOAD_ERROR", message: "File type not allowed" } }, { status: 400 })
      )
    );

    const { result } = renderHookWithClient(() => useUploadAttachment("chat-1"));
    result.current.mutate(file);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ status: 400, message: "File type not allowed", code: "ATTACHMENT_UPLOAD_ERROR" });
  });

  it("AC-71: surfaces the message when the chat's model cannot handle the attachment", async () => {
    server.use(
      http.post("*/chats/:chatId/attachments", () =>
        HttpResponse.json({ error: { code: "ATTACHMENT_NOT_SUPPORTED", message: "This model does not accept images" } }, { status: 422 })
      )
    );

    const { result } = renderHookWithClient(() => useUploadAttachment("chat-1"));
    result.current.mutate(new NodeFile(["x"], "pic.png", { type: "image/png" }) as unknown as File);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("This model does not accept images");
  });
});
