import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttachmentPicker } from "./AttachmentPicker";

describe("AttachmentPicker (AC-66)", () => {
  it("AC-66: notifies with the selected files", async () => {
    const onSelect = vi.fn();
    render(<AttachmentPicker onSelect={onSelect} />);

    const file = new File(["hi"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Attach a file"), file);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [firstCall] = onSelect.mock.calls;
    expect(firstCall?.[0]).toHaveLength(1);
  });

  it("does nothing when the file dialog is dismissed without a selection", () => {
    const onSelect = vi.fn();
    render(<AttachmentPicker onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [] } });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
