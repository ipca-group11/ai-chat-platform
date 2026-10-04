import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { ApiKeyForm } from "./ApiKeyForm";

describe("ApiKeyForm", () => {
  it("AC-76: saving a new key calls onSave with the trimmed key and clears the input", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderWithClient(
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
    renderWithClient(
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

  it("shows an error and keeps the typed key when saving fails", async () => {
    const onSave = vi.fn(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const user = userEvent.setup();
    renderWithClient(
      <ApiKeyForm hasKey={false} onRemove={vi.fn()} onSave={onSave} provider="openai" providerLabel="OpenAI" />,
    );

    const input = screen.getByLabelText("OpenAI API key");
    await user.type(input, "sk-abcd1234");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be saved in this browser/i);
    expect(input).toHaveValue("sk-abcd1234");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("says the previous key is still in use when updating it fails", async () => {
    const onSave = vi.fn(() => {
      throw new Error("refused");
    });
    const user = userEvent.setup();
    renderWithClient(
      <ApiKeyForm hasKey={true} onRemove={vi.fn()} onSave={onSave} provider="anthropic" providerLabel="Anthropic" />,
    );

    await user.type(screen.getByLabelText("Anthropic API key"), "sk-ant-new");
    await user.click(screen.getByRole("button", { name: "Update key" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/your previous key is still in use/i);
  });

  it("AC-76: shows Update/Remove instead of Save when a key already exists", () => {
    renderWithClient(
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
    renderWithClient(
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
