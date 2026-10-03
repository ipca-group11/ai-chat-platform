import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderModelSelect } from "./ProviderModelSelect";

describe("ProviderModelSelect (AC-48, AC-49)", () => {
  it("AC-48: lets the user pick a provider and a model", async () => {
    const onChange = vi.fn();
    render(<ProviderModelSelect provider="anthropic" model="claude-3-5-haiku-latest" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(await screen.findByRole("option", { name: "claude-sonnet-5-5" }));

    expect(onChange).toHaveBeenCalledWith({ provider: "anthropic", model: "claude-sonnet-5-5" });
  });

  it("AC-49: switching provider resets the model to one supported by that provider", async () => {
    const onChange = vi.fn();
    render(<ProviderModelSelect provider="anthropic" model="claude-3-5-haiku-latest" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Provider"));
    await userEvent.click(await screen.findByRole("option", { name: "OpenAI" }));

    expect(onChange).toHaveBeenCalledWith({ provider: "openai", model: "gpt-4o" });
  });
});
