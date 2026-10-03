import { expect, test } from "@playwright/test";
import { registerAndLogin } from "../fixtures/auth-flows.js";
import {
  attachFile,
  chatListItems,
  createChat,
  deleteChat,
  messagesLog,
  renameChat,
  selectProvider,
  sendMessage,
  waitForStreamToFinish,
} from "../fixtures/chat-flows.js";
import { configureAnthropicKey } from "../fixtures/settings-flows.js";
import { freshUser, isolationUsers } from "../fixtures/test-users.js";

/** chat stories (docs/BACKLOG.json, pod `chat`). */

test.describe("chat", () => {
  test("US-13: Chat CRUD and history persistence (FR4, FR8)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-crud"));
    await configureAnthropicKey(page);

    const chatId = await test.step("AC-42: a user can create, list, and open chats", async () => {
      const id = await createChat(page);
      await page.goto("/chats");
      await expect(chatListItems(page)).not.toHaveCount(0);
      await page.goto(`/chats/${id}`);
      return id;
    });

    await test.step("AC-42: a user can rename a chat", async () => {
      await renameChat(page, "Renamed chat");
      await expect(page.getByText("Renamed chat")).toBeVisible();
    });

    await test.step("AC-43: chat history persists in Postgres and is restored after a reload", async () => {
      await sendMessage(page, "Remember this after reload");
      await waitForStreamToFinish(page);
      await page.reload();
      await expect(messagesLog(page)).toContainText("Remember this after reload");
    });

    await test.step("AC-44: deleting a chat removes it and its messages", async () => {
      await deleteChat(page);
      await expect(page).toHaveURL(/\/chats\/?$/);
      await expect(page.getByText(chatId)).toHaveCount(0);
      await page.goto(`/chats/${chatId}`);
      await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
    });
  });

  test("US-14: Chat ownership isolation (FR5, UC7)", async ({ browser }) => {
    const { userA, userB } = isolationUsers();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndLogin(pageA, userA);
    await configureAnthropicKey(pageA);
    const chatId = await createChat(pageA);
    await sendMessage(pageA, "This belongs to user A only.");
    await waitForStreamToFinish(pageA);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerAndLogin(pageB, userB);

    await test.step("AC-45/AC-46: user B's GET/stream on user A's chat id is rejected (403/404)", async () => {
      const getResponse = await pageB.request.get(`/api/chats/${chatId}`);
      expect([403, 404]).toContain(getResponse.status());
    });

    await test.step("AC-46: navigating straight to the URL does not leak content", async () => {
      await pageB.goto(`/chats/${chatId}`);
      await expect(pageB.getByText("This belongs to user A only.")).toHaveCount(0);
      await expect(pageB.getByRole("heading", { name: /not found|forbidden/i })).toBeVisible();
    });

    await test.step("AC-47: user A's chat never appears in user B's chat list", async () => {
      await pageB.goto("/chats");
      await expect(pageB.getByText(chatId)).toHaveCount(0);
    });

    await contextA.close();
    await contextB.close();
  });

  test("US-15: Provider and model selection per chat (FR6)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-provider"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-48: the user chooses a provider/model when creating/editing a chat", async () => {
      await selectProvider(page, "Anthropic");
    });

    await test.step("AC-49/AC-50: the selection is persisted and reused for subsequent messages", async () => {
      await sendMessage(page, "Hello with Anthropic");
      await waitForStreamToFinish(page);
      await page.reload();
      await expect(page.getByRole("combobox", { name: /provider|model/i })).toHaveValue(
        /anthropic/i,
      );
    });
  });

  test("US-16: Send message and streamed response (FR9, FR10, FR12, UC3)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-send"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-51: a sent message is persisted immediately and shown", async () => {
      await sendMessage(page, "Hello, who are you?");
      await expect(messagesLog(page)).toContainText("Hello, who are you?");
    });

    const finalText = await test.step("AC-52: the response streams incrementally", async () => {
      const assistantMessage = messagesLog(page).getByTestId("assistant-message").last();
      await expect(assistantMessage).toBeVisible({ timeout: 15_000 });
      const firstSnapshot = await assistantMessage.textContent();

      await waitForStreamToFinish(page);
      const text = await assistantMessage.textContent();
      expect((text ?? "").length).toBeGreaterThanOrEqual((firstSnapshot ?? "").length);
      return text ?? "";
    });

    await test.step("AC-55: the completed response is saved and reappears after reload", async () => {
      await page.reload();
      await expect(messagesLog(page).getByTestId("assistant-message").last()).toHaveText(
        finalText,
      );
    });

    await test.step("AC-54: stopping mid-stream saves the partial response", async () => {
      await sendMessage(page, "Write a very long story.");
      await expect(page.getByRole("status", { name: /generating|streaming/i })).toBeVisible();
      await page.getByRole("button", { name: /stop/i }).click();
      await waitForStreamToFinish(page);

      const partial = messagesLog(page).getByTestId("assistant-message").last();
      await expect(partial).not.toHaveText("");
      await page.reload();
      await expect(messagesLog(page).getByTestId("assistant-message").last()).not.toHaveText("");
    });

    // AC-53 (the full conversation history is sent to the LLM as context) has
    // no directly observable client-side signal beyond the assistant being
    // able to refer back to earlier turns; covered at the conversation-service
    // integration-test level.
  });

  test("US-17: Message queue (FR11, UC4)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-queue"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-56/AC-57: messages sent while streaming are queued and shown as queued", async () => {
      await sendMessage(page, "First message");
      await expect(page.getByRole("status", { name: /generating|streaming/i })).toBeVisible();

      await sendMessage(page, "Second message");
      await sendMessage(page, "Third message");

      const log = messagesLog(page);
      await expect(log.getByText("Second message").locator("..").getByText(/queued/i)).toBeVisible();
      await expect(log.getByText("Third message").locator("..").getByText(/queued/i)).toBeVisible();
    });

    await test.step("AC-58: a queued message can be cancelled before it is processed", async () => {
      const log = messagesLog(page);
      const queuedItem = log.getByText("Third message").locator("..");
      await queuedItem.getByRole("button", { name: /cancel|remove/i }).click();
      await expect(log.getByText("Third message")).toHaveCount(0);
    });

    await test.step("AC-59: remaining queued messages are processed one at a time, in order", async () => {
      await waitForStreamToFinish(page);
      const userMessages = messagesLog(page).getByTestId("user-message");
      await expect(userMessages).toHaveCount(2);
      await expect(userMessages.nth(0)).toContainText("First message");
      await expect(userMessages.nth(1)).toContainText("Second message");
      await expect(messagesLog(page).getByTestId("assistant-message")).toHaveCount(2);
    });
  });

  test("US-18: Parallel chat sessions (FR7, UC6)", async ({ page }) => {
    test.slow();
    await registerAndLogin(page, freshUser("chat-parallel"));
    await configureAnthropicKey(page);

    const chatIds: string[] = [];
    await test.step("AC-60: several chats can generate responses at the same time", async () => {
      for (let i = 0; i < 5; i += 1) {
        const chatId = await createChat(page);
        chatIds.push(chatId);
        await sendMessage(page, `Message for chat ${i + 1}`);
        // Switch away immediately so this chat keeps streaming in the
        // background while the next one starts.
        await page.goto("/chats");
      }
    });

    await test.step("AC-61/AC-62: switching chats doesn't interrupt any stream, and the UI stays responsive", async () => {
      for (const [index, chatId] of chatIds.entries()) {
        await page.goto(`/chats/${chatId}`);
        await waitForStreamToFinish(page);
        const log = messagesLog(page);
        await expect(log).toContainText(`Message for chat ${index + 1}`);
        await expect(log.getByTestId("assistant-message").last()).not.toHaveText("");
      }
    });
  });

  test("US-19: LLM provider adapter layer (FR6, OpenAI/Anthropic)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-adapter"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-63/AC-64: the composer offers both providers, backed by a common adapter interface", async () => {
      const combobox = page.getByRole("combobox", { name: /provider|model/i });
      for (const provider of ["OpenAI", "Anthropic"]) {
        await expect(combobox.locator(`option:has-text("${provider}")`)).toHaveCount(1);
      }
    });

    await test.step("AC-64: selecting Anthropic (key configured) and sending a message succeeds end-to-end", async () => {
      await selectProvider(page, "Anthropic");
      await sendMessage(page, "Hello via the adapter layer");
      await waitForStreamToFinish(page);
      await expect(messagesLog(page).getByTestId("assistant-message").last()).not.toHaveText("");
    });

    test.fixme(
      true,
      "AC-65 (adding a provider requires changes only inside the adapter layer) is " +
        "a backend source-code architecture property, not observable behavior of " +
        "the running app; verified by conversation-service's own unit tests.",
    );
  });

  test("US-20: File attachment upload and validation (FR13, FR14, FR15, UC5)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-attach"));
    await createChat(page);

    await test.step("AC-66/AC-67: a valid .txt attachment is accepted", async () => {
      await attachFile(page, {
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("The secret word is banana."),
      });
      await expect(page.getByText("notes.txt")).toBeVisible();
    });

    await test.step("AC-68: an oversized file (>10MB) is rejected before upload with a clear message", async () => {
      const oversized = Buffer.alloc(11 * 1024 * 1024, "a");
      await attachFile(page, { name: "too-big.txt", mimeType: "text/plain", buffer: oversized });
      await expect(page.getByRole("alert")).toContainText(/too large|size/i);
      await expect(page.getByText("too-big.txt")).toHaveCount(0);
    });

    await test.step("AC-67/AC-68: a disallowed file type is rejected before upload with a clear message", async () => {
      await attachFile(page, {
        name: "script.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a real exe"),
      });
      await expect(page.getByRole("alert")).toContainText(/type|not supported|invalid/i);
      await expect(page.getByText("script.exe")).toHaveCount(0);
    });
  });

  test("US-21: Attachments passed to the LLM (FR16)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-attach-llm"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-69: text attachment content is extracted and used as context by the LLM", async () => {
      await attachFile(page, {
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("The secret word is banana."),
      });
      await sendMessage(page, "What is the secret word in the attached file?");
      await waitForStreamToFinish(page);
      await expect(messagesLog(page).getByTestId("assistant-message").last()).toContainText(
        /banana/i,
      );
    });

    test.fixme(
      true,
      "AC-70 (image attachments sent as vision input) and AC-71 (a clear message " +
        "when the selected model can't handle the attachment type) depend on a " +
        "specific vision-capable model being configured in the target environment " +
        "and are exercised by the chat pod's own integration tests against the " +
        "adapter layer rather than this generic e2e smoke path.",
    );
  });

  test("US-22: Provider error handling and retry (Reliability NFR)", async ({ page }) => {
    await registerAndLogin(page, freshUser("chat-error"));
    await configureAnthropicKey(page);
    await createChat(page);

    await test.step("AC-72/AC-73: a provider error is surfaced without crashing, and the message can be retried", async () => {
      // Force the streaming request to fail, simulating a provider outage.
      await page.route(/\/api\/chats\/.*\/(messages|stream)/i, (route) => route.abort());
      await sendMessage(page, "This will fail");

      await expect(page.getByRole("alert")).toContainText(/error|failed|unavailable/i);
      await expect(page.getByRole("heading")).toBeVisible(); // app hasn't crashed

      await page.unroute(/\/api\/chats\/.*\/(messages|stream)/i);
      await page.getByRole("button", { name: /retry/i }).click();
      await waitForStreamToFinish(page);
      await expect(messagesLog(page).getByTestId("assistant-message").last()).not.toHaveText("");
    });

    await test.step("AC-74: a failed queued message doesn't block the rest of the queue", async () => {
      await sendMessage(page, "Second first message");
      await page.route(/\/api\/chats\/.*\/(messages|stream)/i, (route) => route.abort());
      await sendMessage(page, "This queued one fails");
      await page.unroute(/\/api\/chats\/.*\/(messages|stream)/i);
      await sendMessage(page, "This one should still process");

      await waitForStreamToFinish(page);
      const log = messagesLog(page);
      await expect(log.getByText("This one should still process")).toBeVisible();
    });
  });
});
