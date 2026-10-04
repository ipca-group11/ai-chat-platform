import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { recordRequests } from "@platform/test-utils/msw";
import type { Attachment } from "../../../shared/types";
import { usePendingAttachments } from "./usePendingAttachments";

function makeFile(name: string, type: string, sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("usePendingAttachments (AC-66, AC-67, AC-68, AC-71)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AC-66/AC-67: uploads a valid file and exposes its attachment id once uploaded", async () => {
    const attachment: Attachment = {
      id: "att-1",
      messageId: "",
      filename: "notes.txt",
      mimeType: "text/plain",
      size: 100,
      kind: "text",
    };
    // Left as a stub on purpose: Node's fetch cannot read the multipart body of a jsdom FormData holding a
    // jsdom File ("reading '_buffer'"), so an upload never reaches the MSW server in this environment.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ attachment }, { status: 201 }));

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("notes.txt", "text/plain")]));

    await waitFor(() => expect(result.current.pending[0]?.status).toBe("uploaded"));
    expect(result.current.uploadedAttachmentIds).toEqual(["att-1"]);
  });

  it("AC-66: settles every file when several are picked at once", async () => {
    const attachment = (id: string, filename: string): Attachment => ({
      id,
      messageId: "",
      filename,
      mimeType: "text/plain",
      size: 100,
      kind: "text",
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ attachment: attachment("att-a", "a.txt") }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ attachment: attachment("att-b", "b.txt") }, { status: 201 }));

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("a.txt", "text/plain"), makeFile("b.txt", "text/plain")]));

    await waitFor(() => expect(result.current.pending.map((p) => p.status)).toEqual(["uploaded", "uploaded"]));
    expect(result.current.uploadedAttachmentIds).toEqual(["att-a", "att-b"]);
    expect(result.current.hasBlockingUploads).toBe(false);
  });

  it("AC-68: rejects an oversized file before upload, with no network call", () => {
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("big.txt", "text/plain", 11 * 1024 * 1024)]));

    expect(result.current.pending[0]?.status).toBe("rejected");
    expect(result.current.pending[0]?.error).toContain("big.txt");
    expect(requests).toHaveLength(0);
  });

  it("AICHAT-218: a 413 from the server marks the file as too large, even without a JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<h1>413 Request Entity Too Large</h1>", { status: 413, statusText: "Payload Too Large" })
    );

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("notes.txt", "text/plain")]));

    await waitFor(() => expect(result.current.pending[0]?.status).toBe("rejected"));
    expect(result.current.pending[0]?.error).toBe('"notes.txt" is larger than the 10 MB limit.');
    expect(result.current.uploadedAttachmentIds).toEqual([]);
  });

  it("keeps the server's message for any other upload error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: { code: "ATTACHMENT_TYPE_NOT_ALLOWED", message: "Not allowed here" } }, { status: 400 })
    );

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("notes.txt", "text/plain")]));

    await waitFor(() => expect(result.current.pending[0]?.status).toBe("rejected"));
    expect(result.current.pending[0]?.error).toBe("Not allowed here");
  });

  it("AC-71: rejects an image attachment for a model without vision support, before sending", () => {
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-2.1"));

    act(() => result.current.addFiles([makeFile("photo.png", "image/png")]));

    expect(result.current.pending[0]?.status).toBe("rejected");
    expect(result.current.pending[0]?.error).toMatch(/does not support image/i);
    expect(requests).toHaveLength(0);
  });

  it("removePending removes a staged attachment", () => {
    const { result } = renderHookWithClient(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"));

    act(() => result.current.addFiles([makeFile("big.txt", "text/plain", 11 * 1024 * 1024)]));
    const id = result.current.pending[0]!.id;
    act(() => result.current.removePending(id));

    expect(result.current.pending).toEqual([]);
  });
});
