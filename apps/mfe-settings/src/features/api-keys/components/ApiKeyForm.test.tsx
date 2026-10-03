import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../../shared/test/render";
import { ApiKeyForm } from "./ApiKeyForm";

describe("ApiKeyForm", () => {
  it("AC-76: saving a new key calls onSave with the trimmed key and clears the input", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderWithQueryClient(
      <ApiKeyForm
        hasKey={false}
        onRemove={vi.fn()}
        onSave={onSave}
        provider="openai"
        providerLabel="OpenAI"
      />,
    );

    const input = screen.getByLabelText("OpenAI API key");
    await user.type(input, "  sk-abcd1234  ");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(onSave).toHaveBeenCalledWith("sk-abcd1234");
    expect(input).toHaveValue("");
  });

  it("AC-76: does not call onSave when the input is empty", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderWithQueryClient(
      <ApiKeyForm
        hasKey={false}
        onRemove={vi.fn()}
        onSave={onSave}
        provider="openai"
        providerLabel="OpenAI"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/api key is required/i);
  });

  it("AC-76: shows Update/Remove instead of Save when a key already exists", () => {
    renderWithQueryClient(
      <ApiKeyForm
        hasKey={true}
        onRemove={vi.fn()}
        onSave={vi.fn()}
        provider="anthropic"
        providerLabel="Anthropic"
      />,
    );

    expect(screen.getByRole("button", { name: "Update key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove key" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save key" })).not.toBeInTheDocument();
  });

  it("AC-87: clicking Remove calls onRemove", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderWithQueryClient(
      <ApiKeyForm
        hasKey={true}
        onRemove={onRemove}
        onSave={vi.fn()}
        provider="anthropic"
        providerLabel="Anthropic"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove key" }));

    expect(onRemove).toHaveBeenCalled();
  });
});
