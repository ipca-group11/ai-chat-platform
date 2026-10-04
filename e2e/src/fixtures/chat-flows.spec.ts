import { describe, expect, it, vi } from "vitest";
import { createFakePage } from "../test-utils/fake-page.js";

const countExpectations: Array<{ target: string; count: number; options: unknown }> = [];

vi.mock("@playwright/test", () => ({
  expect: (locator: { describe?: string }) => ({
    toHaveCount: (count: number, options: unknown) => {
      countExpectations.push({ target: String(locator), count, options });
      return Promise.resolve();
    },
  }),
}));

const flows = await import("./chat-flows.js");

describe("chat flows", () => {
  it("createChat opens the list, clicks New chat and returns the id from the URL", async () => {
    const { page, calls, state } = createFakePage();
    state.url = "http://localhost:4173/chats/abc-123";

    const id = await flows.createChat(page);

    expect(id).toBe("abc-123");
    expect(calls).toEqual([
      'goto("/chats")',
      'getByRole("button", {"name":"/new chat/i"}).click()',
      String.raw`waitForURL("/\\/chats\\/[^/]+$/")`,
    ]);
  });

  it("createChat ignores a query string or fragment after the id", async () => {
    const { page, state } = createFakePage();
    state.url = "http://localhost/chats/xyz?tab=1#top";
    expect(await flows.createChat(page)).toBe("xyz");
  });

  it("createChat fails with the URL in the message when no id can be read", async () => {
    const { page, state } = createFakePage();
    state.url = "http://localhost/chats";
    await expect(flows.createChat(page)).rejects.toThrow("Could not extract chat id from URL: http://localhost/chats");
  });

  it("sendMessage types into the message box and clicks Send", async () => {
    const { page, calls } = createFakePage();
    await flows.sendMessage(page, "hello");
    expect(calls).toEqual([
      'getByRole("textbox", {"name":"/message/i"}).fill("hello")',
      'getByRole("button", {"name":"/^send$/i"}).click()',
    ]);
  });

  it("renameChat opens Rename, types the title and saves", async () => {
    const { page, calls } = createFakePage();
    await flows.renameChat(page, "Plans");
    expect(calls).toEqual([
      'getByRole("button", {"name":"/rename/i"}).click()',
      'getByRole("textbox", {"name":"/chat name|title/i"}).fill("Plans")',
      'getByRole("button", {"name":"/^save$/i"}).click()',
    ]);
  });

  it("deleteChat confirms with the last matching button", async () => {
    const { page, calls } = createFakePage();
    await flows.deleteChat(page);
    expect(calls).toEqual([
      'getByRole("button", {"name":"/delete/i"}).click()',
      'getByRole("button", {"name":"/confirm|delete/i"}).last().click()',
    ]);
  });

  it("selectProvider picks the option by label", async () => {
    const { page, calls } = createFakePage();
    await flows.selectProvider(page, "Anthropic");
    expect(calls).toEqual(['getByRole("combobox", {"name":"/provider|model/i"}).selectOption({"label":"Anthropic"})']);
  });

  it("attachFile hands the in-memory file to the attach input", async () => {
    const { page, calls } = createFakePage();
    const file = { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") };
    await flows.attachFile(page, file);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^getByLabel\("\/attach a file\/i"\)\.setInputFiles\(/);
    expect(calls[0]).toContain('"name":"a.txt"');
  });

  it("returns locators for the composer, message log and chat list items", () => {
    const { page, calls } = createFakePage();
    flows.messageComposer(page).fill("x");
    flows.messagesLog(page).click();
    flows.chatListItems(page).click();
    expect(calls).toEqual([
      'getByRole("textbox", {"name":"/message/i"}).fill("x")',
      'getByRole("log", {"name":"/messages/i"}).click()',
      'getByRole("list", {"name":"/chats/i"}).getByRole("listitem").click()',
    ]);
  });

  it("waitForStreamToFinish expects no generating status within 30 seconds", async () => {
    countExpectations.length = 0;
    const { page } = createFakePage();
    await flows.waitForStreamToFinish(page);
    expect(countExpectations).toHaveLength(1);
    expect(countExpectations[0]).toMatchObject({ count: 0, options: { timeout: 30_000 } });
  });
});
