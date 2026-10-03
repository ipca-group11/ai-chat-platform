import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { MaskedKeyDisplay } from "./MaskedKeyDisplay";

describe("MaskedKeyDisplay", () => {
  it("AC-76: shows 'No key configured' when there is no record", () => {
    renderWithClient(<MaskedKeyDisplay record={null} />);

    expect(screen.getByTestId("masked-key-empty")).toHaveTextContent("No key configured");
  });

  it("AC-84: masks the key, revealing only the last 4 characters", () => {
    renderWithClient(
      <MaskedKeyDisplay
        record={{ provider: "openai", last4: "a1b2", createdAt: new Date().toISOString() }}
      />,
    );

    const masked = screen.getByTestId("masked-key");
    expect(masked).toHaveTextContent("a1b2");
    expect(masked.textContent).not.toContain("sk-");
  });
});
