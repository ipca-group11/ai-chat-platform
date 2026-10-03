import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, withQueryClient } from "../../../test/utils";
import type { Attachment } from "../../../shared/types";
import { usePendingAttachments } from "./usePendingAttachments";

function makeFile(name: string, type: string, sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("usePendingAttachments (AC-66, AC-67, AC-68, AC-71)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-66/AC-67: uploads a valid file and exposes its attachment id once uploaded", async () => {
    const attachment: Attachment = {
      id: "att-1",
      messageId: "",
      filename: "notes.txt",
      mimeType: "text/plain",
      size: 100,
      kind: "text",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(attachment)));

    const { result } = renderHook(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"), {
      wrapper: withQueryClient(),
    });

    act(() => result.current.addFiles([makeFile("notes.txt", "text/plain")]));

    await waitFor(() => expect(result.current.pending[0]?.status).toBe("uploaded"));
    expect(result.current.uploadedAttachmentIds).toEqual(["att-1"]);
  });

  it("AC-68: rejects an oversized file before upload, with no network call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"), {
      wrapper: withQueryClient(),
    });

    act(() => result.current.addFiles([makeFile("big.txt", "text/plain", 11 * 1024 * 1024)]));

    expect(result.current.pending[0]?.status).toBe("rejected");
    expect(result.current.pending[0]?.error).toContain("big.txt");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-71: rejects an image attachment for a model without vision support, before sending", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"), {
      wrapper: withQueryClient(),
    });

    act(() => result.current.addFiles([makeFile("photo.png", "image/png")]));

    expect(result.current.pending[0]?.status).toBe("rejected");
    expect(result.current.pending[0]?.error).toMatch(/does not support image/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removePending removes a staged attachment", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => usePendingAttachments("chat-1", "anthropic", "claude-3-5-haiku-latest"), {
      wrapper: withQueryClient(),
    });

    act(() => result.current.addFiles([makeFile("big.txt", "text/plain", 11 * 1024 * 1024)]));
    const id = result.current.pending[0]!.id;
    act(() => result.current.removePending(id));

    expect(result.current.pending).toEqual([]);
  });
});
