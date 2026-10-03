import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PendingAttachment } from "../hooks/usePendingAttachments";
import { AttachmentList } from "./AttachmentList";

function makePending(overrides: Partial<PendingAttachment>): PendingAttachment {
  return {
    id: "att-1",
    file: new File(["hi"], "notes.txt", { type: "text/plain" }),
    status: "uploading",
    ...overrides,
  };
}

describe("AttachmentList (AC-66, AC-67, AC-68, AC-71)", () => {
  it("renders nothing when there are no staged attachments", () => {
    const { container } = render(<AttachmentList attachments={[]} onRemove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an in-progress badge while uploading", () => {
    render(<AttachmentList attachments={[makePending({ status: "uploading" })]} onRemove={vi.fn()} />);
    expect(screen.getByText("uploading")).toBeInTheDocument();
  });

  it("shows an uploaded badge once done", () => {
    render(<AttachmentList attachments={[makePending({ status: "uploaded" })]} onRemove={vi.fn()} />);
    expect(screen.getByText("uploaded")).toBeInTheDocument();
  });

  it("AC-68/AC-71: shows the rejection reason as an alert instead of a badge", () => {
    render(
      <AttachmentList
        attachments={[makePending({ status: "rejected", error: "too big" })]}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("too big");
  });

  it("removes a staged attachment", async () => {
    const onRemove = vi.fn();
    render(<AttachmentList attachments={[makePending({ status: "uploaded" })]} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("Remove notes.txt"));

    expect(onRemove).toHaveBeenCalledWith("att-1");
  });
});
