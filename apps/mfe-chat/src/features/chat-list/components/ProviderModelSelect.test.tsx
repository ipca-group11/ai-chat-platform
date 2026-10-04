import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderModelSelect } from "./ProviderModelSelect";

describe("ProviderModelSelect (AC-48, AC-49)", () => {
  it("AC-48: lets the user pick a provider and a model", async () => {
    const onChange = vi.fn();
    render(<ProviderModelSelect provider="ollama" model="llama3.2:1b" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(await screen.findByRole("option", { name: "llama3.1:8b" }));

    expect(onChange).toHaveBeenCalledWith({ provider: "ollama", model: "llama3.1:8b" });
  });

  it("AC-49: switching provider resets the model to one supported by that provider", async () => {
    const onChange = vi.fn();
    render(<ProviderModelSelect provider="ollama" model="llama3.2:1b" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Provider"));
    await userEvent.click(await screen.findByRole("option", { name: "OpenAI" }));

    expect(onChange).toHaveBeenCalledWith({ provider: "openai", model: "gpt-4o" });
  });
});
