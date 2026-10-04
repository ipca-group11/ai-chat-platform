import { describe, expect, it } from "vitest";
import { ChatView as EagerChatView } from "../features/chat-view";
import { ChatView, loadChatView } from "./lazy-chat-view";

describe("lazy chat view (AICHAT-239)", () => {
  it("loads the chat-view feature module on demand", async () => {
    const mod = await loadChatView();
    expect(mod.ChatView).toBe(EagerChatView);
  });

  it("exposes the chat view as a lazy component", () => {
    expect((ChatView as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for("react.lazy"));
  });
});
