import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReasoningSection } from "./ReasoningSection";

describe("ReasoningSection", () => {
  it("is open and marked as thinking while the answer has not started", () => {
    render(<ReasoningSection reasoning="Step one" thinking />);

    const toggle = screen.getByRole("button", { name: "Thinking…" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Model reasoning" })).toHaveTextContent("Step one");
  });

  it("is collapsed once the answer has started", () => {
    render(<ReasoningSection reasoning="Step one" thinking={false} />);

    expect(screen.getByRole("button", { name: "Thinking" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Model reasoning" })).not.toBeInTheDocument();
  });

  it("opens and closes on click", async () => {
    render(<ReasoningSection reasoning="Step one" thinking={false} />);
    const toggle = screen.getByRole("button", { name: "Thinking" });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Model reasoning" })).toHaveTextContent("Step one");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Model reasoning" })).not.toBeInTheDocument();
  });

  it("keeps a section the user closed shut when the model is still thinking", async () => {
    const { rerender } = render(<ReasoningSection reasoning="Step one" thinking />);

    await userEvent.click(screen.getByRole("button", { name: "Thinking…" }));
    rerender(<ReasoningSection reasoning="Step one and two" thinking />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a section the user opened open after the answer starts", async () => {
    const { rerender } = render(<ReasoningSection reasoning="Step one" thinking={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Thinking" }));
    rerender(<ReasoningSection reasoning="Step one" thinking={false} />);

    expect(screen.getByRole("region", { name: "Model reasoning" })).toBeInTheDocument();
  });

  it("collapses by itself when the answer starts, if the user never touched it", () => {
    const { rerender } = render(<ReasoningSection reasoning="Step one" thinking />);
    expect(screen.getByRole("region", { name: "Model reasoning" })).toBeInTheDocument();

    rerender(<ReasoningSection reasoning="Step one" thinking={false} />);

    expect(screen.queryByRole("region", { name: "Model reasoning" })).not.toBeInTheDocument();
  });
});
