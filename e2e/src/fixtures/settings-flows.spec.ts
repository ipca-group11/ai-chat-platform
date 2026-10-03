import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePage } from "../test-utils/fake-page.js";

const skip = vi.hoisted(() => vi.fn());

vi.mock("@playwright/test", () => ({ test: { skip } }));

afterEach(() => {
  skip.mockReset();
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function load(key: string) {
  vi.stubEnv("ANTHROPIC_API_KEY", key);
  vi.resetModules();
  return import("./settings-flows.js");
}

describe("settings flows", () => {
  it("openSettings goes to /settings", async () => {
    const flows = await load("");
    const { page, calls } = createFakePage();
    await flows.openSettings(page);
    expect(calls).toEqual(['goto("/settings")']);
  });

  it("apiKeyField matches the provider's API key label, ignoring case", async () => {
    const flows = await load("");
    const { page, calls } = createFakePage();
    flows.apiKeyField(page, "OpenAI").fill("x");
    expect(calls).toEqual(['getByLabel("/OpenAI.*api key/i").fill("x")']);
  });

  it("saveApiKey fills the field and submits that provider's form", async () => {
    const flows = await load("");
    const { page, calls } = createFakePage();
    await flows.saveApiKey(page, "Anthropic", "sk-1");
    expect(calls).toEqual([
      'getByLabel("/Anthropic.*api key/i").fill("sk-1")',
      'getByRole("form", {"name":"/Anthropic API key form/i"}).getByRole("button", {"name":"/save key|update key/i"}).click()',
    ]);
  });

  it("removeApiKey clicks Remove in the field's parent row", async () => {
    const flows = await load("");
    const { page, calls } = createFakePage();
    await flows.removeApiKey(page, "OpenAI");
    expect(calls).toEqual(['getByLabel("/OpenAI.*api key/i").locator("..").getByRole("button", {"name":"/remove/i"}).click()']);
  });

  it("testConnection clicks Test connection in the field's parent row", async () => {
    const flows = await load("");
    const { page, calls } = createFakePage();
    await flows.testConnection(page, "OpenAI");
    expect(calls).toEqual(['getByLabel("/OpenAI.*api key/i").locator("..").getByRole("button", {"name":"/test connection/i"}).click()']);
  });

  it("configureAnthropicKey skips the test when no key is configured", async () => {
    const flows = await load("");
    const { page } = createFakePage();
    await flows.configureAnthropicKey(page);
    expect(skip).toHaveBeenCalledWith(true, expect.stringContaining("ANTHROPIC_API_KEY"));
  });

  it("configureAnthropicKey saves the configured key from the settings page", async () => {
    const flows = await load("sk-ant-test");
    const { page, calls } = createFakePage();
    await flows.configureAnthropicKey(page);
    expect(skip).toHaveBeenCalledWith(false, expect.any(String));
    expect(calls).toEqual([
      'goto("/settings")',
      'getByRole("form", {"name":"/anthropic api key form/i"}).getByRole("textbox", {"name":"/anthropic api key/i"}).fill("sk-ant-test")',
      'getByRole("form", {"name":"/anthropic api key form/i"}).getByRole("button", {"name":"/save key|update key/i"}).click()',
    ]);
  });
});
