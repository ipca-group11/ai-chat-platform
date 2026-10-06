import { randomUUID } from "node:crypto";
import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import { logIn, registerAndLogIn, type Account } from "./support/auth.js";
import { countMessages } from "./support/db.js";

/** The LLM mock conversation-service calls (compose.mock.yaml, profile `llm`); its request log is read for AC-53. */
const mockServerUrl = process.env["E2E_MOCK_SERVER_URL"] ?? "http://localhost:4010";
/** The mock accepts any key; against a real provider set E2E_ANTHROPIC_API_KEY. */
const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const provider = "anthropic";
const defaultModel = "claude-haiku-4-5";
/** The mock's `long` scenario (ten times the default answer): long enough to watch the stream and stop it. */
const longReplyModel = `${defaultModel}@long`;
/** The mock's `error-500` scenario: the reply fails, which leaves a `failed` message in the chat. */
const failingModel = `${defaultModel}@error-500`;

interface Chat {
  id: string;
  title: string;
  provider: string;
  model: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "sent" | "queued" | "streaming" | "failed";
}

/** A message as conversation-service sends it to the Anthropic Messages API. */
interface ProviderMessage {
  role: string;
  content: string | { type: string; text?: string }[];
}

async function saveAnthropicKey(page: Page) {
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toHaveText(`••••${anthropicKey.slice(-4)}`);
}

async function goToChats(page: Page) {
  await page.goto("/chats");
  await expect(page.getByTestId("chats-heading")).toBeVisible();
}

// --- conversation-service through the shell's /api proxy (same session as the browser) ---

async function createChat(page: Page, title: string, model = defaultModel): Promise<Chat> {
  const response = await page.request.post("/api/chats", { data: { title, provider, model } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { chat: Chat }).chat;
}

async function updateChatModel(page: Page, chatId: string, model: string) {
  const response = await page.request.patch(`/api/chats/${chatId}`, { data: { provider, model } });
  expect(response.ok()).toBeTruthy();
}

async function deleteChat(page: Page, chatId: string) {
  const response = await page.request.delete(`/api/chats/${chatId}`);
  expect(response.status()).toBe(204);
}

async function sendMessage(page: Page, chatId: string, content: string): Promise<Message> {
  const response = await page.request.post(`/api/chats/${chatId}/messages`, {
    data: { content },
    headers: { "X-Llm-Api-Key": anthropicKey },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { message: Message }).message;
}

async function listMessages(page: Page, chatId: string): Promise<Message[]> {
  const response = await page.request.get(`/api/chats/${chatId}/messages`);
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { messages: Message[] }).messages;
}

/** Waits until the reply to `userMessageId` has finished (sent or failed) and returns it. */
async function waitForReply(page: Page, chatId: string, userMessageId: string): Promise<Message> {
  let reply: Message | undefined;
  await expect
    .poll(
      async () => {
        const messages = await listMessages(page, chatId);
        const index = messages.findIndex((m) => m.id === userMessageId);
        reply = messages.slice(index + 1).find((m) => m.role === "assistant");
        return reply?.status;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^(sent|failed)$/);
  return reply as Message;
}

/** Sends a message and waits for its reply; returns both. */
async function exchange(page: Page, chatId: string, content: string) {
  const message = await sendMessage(page, chatId, content);
  const reply = await waitForReply(page, chatId, message.id);
  return { message, reply };
}

/** The requests conversation-service made to the mocked Anthropic API, oldest first. */
async function providerRequests(page: Page): Promise<{ body: { messages: ProviderMessage[] } }[]> {
  const response = await page.request.get(`${mockServerUrl}/__admin/requests`, { params: { mock: "anthropic" } });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { requests: { body: { messages: ProviderMessage[] } }[] }).requests;
}

function providerMessageText(message: ProviderMessage): string {
  return typeof message.content === "string" ? message.content : message.content.map((block) => block.text ?? "").join("");
}

// --- page ---

function chatItem(page: Page, chatId: string): Locator {
  return page.getByTestId(`chat-item-${chatId}`);
}

/** The rows of the "Chats" list whose title is exactly `title`. */
function listedTitles(page: Page, title: string): Locator {
  return page.getByTestId("chat-list").getByTestId("chat-item-title").filter({ hasText: new RegExp(`^${escapeRegExp(title)}$`) });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The row actions only show on hover with a mouse, so the row is hovered before its buttons are clicked. */
async function clickRowAction(page: Page, chatId: string, action: "rename-chat" | "delete-chat") {
  const row = chatItem(page, chatId);
  await row.hover();
  await row.getByTestId(action).click();
}

async function openChat(page: Page, chat: Chat) {
  await page.goto(`/chats/${chat.id}`);
  await expect(page.getByTestId("chat-heading")).toHaveText(chat.title);
}

/** Collects the page's requests that `matches` from now on. */
function trackRequests(page: Page, matches: (request: Request) => boolean): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (matches(request)) seen.push(request);
  });
  return seen;
}

const isRenameRequest = (chatId: string) => (request: Request) =>
  request.method() === "PATCH" && new URL(request.url()).pathname === `/api/chats/${chatId}`;

const isSendMessageRequest = (chatId: string) => (request: Request) =>
  request.method() === "POST" && new URL(request.url()).pathname === `/api/chats/${chatId}/messages`;

// --- shared steps ---

/** The list query loaded before the chat existed, so the page is reopened to show it. */
async function givenChat(page: Page, title: string): Promise<Chat> {
  return test.step(`Given I have a chat "${title}"`, async () => {
    const chat = await createChat(page, title);
    await goToChats(page);
    await expect(listedTitles(page, title)).toHaveCount(1);
    return chat;
  });
}

async function givenOpenChat(page: Page, title: string, model = defaultModel): Promise<Chat> {
  return test.step(`Given I have a chat "${title}" and it is open`, async () => {
    const chat = await createChat(page, title, model);
    await openChat(page, chat);
    return chat;
  });
}

async function givenChatWithExchange(page: Page, title: string, content: string) {
  return test.step(`Given I have a chat "${title}" with the message "${content}" and its completed reply`, async () => {
    const chat = await createChat(page, title);
    const { reply } = await exchange(page, chat.id, content);
    expect(reply.status).toBe("sent");
    expect(reply.content).not.toBe("");
    await openChat(page, chat);
    return { chat, reply };
  });
}

async function whenIClickRename(page: Page, chat: Chat) {
  await test.step(`When I click "Rename ${chat.title}"`, async () => {
    await clickRowAction(page, chat.id, "rename-chat");
    await expect(chatItem(page, chat.id).getByTestId("rename-title")).toHaveValue(chat.title);
  });
}

async function thenListStillShows(page: Page, title: string) {
  await test.step(`Then the "Chats" list still shows "${title}"`, async () => {
    await expect(listedTitles(page, title)).toHaveCount(1);
  });
}

async function andNoRenameRequest(renameRequests: Request[]) {
  await test.step("And no rename request is sent", async () => {
    expect(renameRequests).toEqual([]);
  });
}

async function thenMessagesLogShows(page: Page, keyword: string, label: string, text: string) {
  await test.step(`${keyword} the "Messages" log shows ${label}`, async () => {
    const log = page.getByTestId("messages");
    const bubble = label === "the reply" ? log.getByTestId("assistant-reply") : log.getByTestId("user-message");
    await expect(bubble).toContainText(text);
  });
}

async function andStillNoMessages(page: Page) {
  await test.step('And I still see "No messages yet. Say hello!"', async () => {
    await expect(page.getByTestId("messages-empty")).toHaveText("No messages yet. Say hello!");
  });
}

async function andNoMessageRequest(sendRequests: Request[]) {
  await test.step("And no message request is sent", async () => {
    expect(sendRequests).toEqual([]);
  });
}

/** Sends `content` from the composer and waits for the stream to show. */
async function sendFromComposer(page: Page, content: string) {
  await page.getByTestId("message-input").fill(content);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("generating")).toBeVisible();
}

async function thenGeneratingAndStopDisappear(page: Page, line: string) {
  await test.step(line, async () => {
    await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("stop-response")).toHaveCount(0);
  });
}

test.describe("Chat management and messaging", () => {
  let account: Account;

  test.beforeEach(async ({ page }) => {
    await test.step("Given I am logged in as a registered user", async () => {
      account = await registerAndLogIn(page, "chat");
    });
    await test.step("And I have saved a valid Anthropic API key on the settings page", async () => {
      await saveAnthropicKey(page);
    });
    await test.step('And I am on "/chats"', async () => {
      await goToChats(page);
    });
  });

  // --- US-13: Chat CRUD and history persistence ---

  test("Empty chat list (AC-42)", async ({ page }) => {
    await test.step("Given I have no chats", async () => {
      const response = await page.request.get("/api/chats");
      expect((await response.json()) as { chats: Chat[] }).toEqual({ chats: [] });
    });
    await test.step("When the chat list finishes loading", async () => {
      await expect(page.getByTestId("chat-list-empty").or(page.getByTestId("chat-list"))).toBeVisible();
    });
    await test.step('Then I see "No chats yet. Create one to get started."', async () => {
      await expect(page.getByTestId("chat-list-empty")).toHaveText("No chats yet. Create one to get started.");
    });
    await test.step('And I see the heading "Select a chat"', async () => {
      await expect(page.getByTestId("select-chat-heading")).toHaveText("Select a chat");
    });
  });

  test("Create a chat (AC-42)", async ({ page }) => {
    await test.step('When I click "New chat"', async () => {
      await page.getByTestId("new-chat").click();
    });
    await test.step('And I fill "Title" with "Trip planning"', async () => {
      await page.getByTestId("chat-title").fill("Trip planning");
    });
    await test.step('And I click "Create"', async () => {
      await page.getByTestId("create-chat").click();
    });
    await test.step('Then the "New chat" dialog closes', async () => {
      await expect(page.getByTestId("new-chat-dialog")).toBeHidden();
    });
    const chatId = await test.step('And the URL is "/chats/<id of the new chat>"', async () => {
      await expect(page).toHaveURL(/\/chats\/[^/]+$/);
      return new URL(page.url()).pathname.split("/").pop() ?? "";
    });
    await test.step('And the "Chats" list shows "Trip planning" with "anthropic · claude-haiku-4-5"', async () => {
      const row = chatItem(page, chatId);
      await expect(row.getByTestId("chat-item-title")).toHaveText("Trip planning");
      await expect(row.getByTestId("chat-item-model")).toHaveText("anthropic · claude-haiku-4-5");
    });
    await test.step('And I see "No messages yet. Say hello!"', async () => {
      await expect(page.getByTestId("messages-empty")).toHaveText("No messages yet. Say hello!");
    });
  });

  for (const title of ["", "   "]) {
    test(`A chat without a title cannot be created (AC-42): "${title}"`, async ({ page }) => {
      await test.step('When I click "New chat"', async () => {
        await page.getByTestId("new-chat").click();
      });
      await test.step(`And I fill "Title" with "${title}"`, async () => {
        await page.getByTestId("chat-title").fill(title);
      });
      await test.step('Then the "Create" button is disabled', async () => {
        await expect(page.getByTestId("create-chat")).toBeDisabled();
      });
      await test.step('And the "New chat" dialog stays open', async () => {
        await expect(page.getByTestId("new-chat-dialog")).toBeVisible();
      });
      await test.step('And no chat is added to the "Chats" list', async () => {
        await expect(page.getByTestId("chat-item-title")).toHaveCount(0);
        await expect(page.getByTestId("chat-list-empty")).toHaveText("No chats yet. Create one to get started.");
      });
    });
  }

  test("Open a chat from the list (AC-42)", async ({ page }) => {
    const recipes = await test.step('Given I have the chats "Trip planning" and "Recipes"', async () => {
      await createChat(page, "Trip planning");
      const chat = await createChat(page, "Recipes");
      await goToChats(page);
      await expect(listedTitles(page, "Trip planning")).toHaveCount(1);
      await expect(listedTitles(page, "Recipes")).toHaveCount(1);
      return chat;
    });
    await test.step('When I click "Recipes" in the "Chats" list', async () => {
      await chatItem(page, recipes.id).getByTestId("open-chat").click();
    });
    await test.step('Then the URL is "/chats/<id of Recipes>"', async () => {
      await expect(page).toHaveURL(new RegExp(`/chats/${recipes.id}$`));
    });
    await test.step('And I see the heading "Recipes"', async () => {
      await expect(page.getByTestId("chat-heading")).toHaveText("Recipes");
    });
  });

  test("Rename a chat (AC-42)", async ({ page }) => {
    const chat = await givenChat(page, "Trip planning");
    await whenIClickRename(page, chat);
    await test.step('And I change the title to "Lisbon trip"', async () => {
      await chatItem(page, chat.id).getByTestId("rename-title").fill("Lisbon trip");
    });
    await test.step('And I click "Save"', async () => {
      await chatItem(page, chat.id).getByTestId("save-rename").click();
    });
    await test.step('Then the "Chats" list shows "Lisbon trip"', async () => {
      await expect(listedTitles(page, "Lisbon trip")).toHaveCount(1);
    });
    await test.step('And the "Chats" list does not show "Trip planning"', async () => {
      await expect(listedTitles(page, "Trip planning")).toHaveCount(0);
    });
  });

  test("Renaming to a blank title keeps the old title (AC-42)", async ({ page }) => {
    const chat = await givenChat(page, "Trip planning");
    const renameRequests = trackRequests(page, isRenameRequest(chat.id));
    await whenIClickRename(page, chat);
    await test.step("And I clear the title", async () => {
      await chatItem(page, chat.id).getByTestId("rename-title").fill("");
    });
    await test.step('And I click "Save"', async () => {
      await chatItem(page, chat.id).getByTestId("save-rename").click();
    });
    await thenListStillShows(page, "Trip planning");
    await andNoRenameRequest(renameRequests);
  });

  test("Cancel a rename (AC-42)", async ({ page }) => {
    const chat = await givenChat(page, "Trip planning");
    const renameRequests = trackRequests(page, isRenameRequest(chat.id));
    await whenIClickRename(page, chat);
    await test.step('And I change the title to "Lisbon trip"', async () => {
      await chatItem(page, chat.id).getByTestId("rename-title").fill("Lisbon trip");
    });
    await test.step('And I click "Cancel"', async () => {
      await chatItem(page, chat.id).getByTestId("cancel-rename").click();
    });
    await thenListStillShows(page, "Trip planning");
    await andNoRenameRequest(renameRequests);
  });

  test("Delete the open chat (AC-44)", async ({ page }) => {
    const chat = await givenOpenChat(page, "Trip planning");
    await test.step('When I click "Delete Trip planning"', async () => {
      await clickRowAction(page, chat.id, "delete-chat");
    });
    await test.step('Then the "Chats" list does not show "Trip planning"', async () => {
      await expect(listedTitles(page, "Trip planning")).toHaveCount(0);
      await expect(chatItem(page, chat.id)).toHaveCount(0);
    });
    await test.step('And the URL is "/chats"', async () => {
      await expect(page).toHaveURL(/\/chats$/);
    });
    await test.step('And I see the heading "Select a chat"', async () => {
      await expect(page.getByTestId("select-chat-heading")).toHaveText("Select a chat");
    });
  });

  test("A deleted chat no longer loads (AC-44)", async ({ page }) => {
    const chat = await test.step('Given I deleted the chat "Trip planning"', async () => {
      const created = await createChat(page, "Trip planning");
      await deleteChat(page, created.id);
      return created;
    });
    await test.step('When I open its old URL "/chats/<id of Trip planning>"', async () => {
      await page.goto(`/chats/${chat.id}`);
    });
    await test.step('Then I see the heading "Chat not found"', async () => {
      await expect(page.getByTestId("chat-error-heading")).toHaveText("Chat not found");
    });
    await test.step('And I see "Chat not found. It may have been deleted, or you no longer have access to it."', async () => {
      await expect(page.getByTestId("chat-error-text")).toHaveText(
        "Chat not found. It may have been deleted, or you no longer have access to it.",
      );
    });
    await test.step("And no messages are shown", async () => {
      await expect(page.getByTestId("messages")).toHaveCount(0);
      await expect(page.getByTestId("user-message")).toHaveCount(0);
      await expect(page.getByTestId("assistant-message")).toHaveCount(0);
    });
  });

  test("Deleting a chat removes its messages (AC-44)", { tag: "@api" }, async ({ page }) => {
    const chat = await test.step("Given I deleted a chat that had messages", async () => {
      const created = await createChat(page, "Trip planning");
      await exchange(page, created.id, "Hello, who are you?");
      expect(countMessages(created.id)).toBeGreaterThan(0);
      await deleteChat(page, created.id);
      return created;
    });
    const response = await test.step('When I request GET "/chats/<id>/messages"', async () => {
      return page.request.get(`/api/chats/${chat.id}/messages`);
    });
    await test.step("Then the response status is 404", async () => {
      expect(response.status()).toBe(404);
    });
    await test.step("And the database has no messages for that chat", async () => {
      expect(countMessages(chat.id)).toBe(0);
    });
  });

  test("History is restored after a reload (AC-43)", async ({ page }) => {
    const { reply } = await givenChatWithExchange(page, "Trip planning", "Remember this after reload");
    await test.step("When I reload the page", async () => {
      await page.reload();
      await expect(page.getByTestId("chat-heading")).toHaveText("Trip planning");
    });
    await thenMessagesLogShows(page, "Then", '"Remember this after reload"', "Remember this after reload");
    await thenMessagesLogShows(page, "And", "the reply", reply.content);
  });

  test("History is restored after a new login (AC-43)", async ({ page, browser }) => {
    const { chat, reply } = await givenChatWithExchange(page, "Trip planning", "Remember this after reload");
    const newSession = await test.step('When I log in again in a new browser session and open "Trip planning"', async () => {
      const context = await browser.newContext();
      const newPage = await context.newPage();
      await logIn(newPage, account);
      await chatItem(newPage, chat.id).getByTestId("open-chat").click();
      await expect(newPage.getByTestId("chat-heading")).toHaveText("Trip planning");
      return newPage;
    });
    await thenMessagesLogShows(newSession, "Then", '"Remember this after reload"', "Remember this after reload");
    await thenMessagesLogShows(newSession, "And", "the reply", reply.content);
    await newSession.context().close();
  });

  // --- UC3 / US-16: Send a message and receive a streamed response ---

  const sendActions = [
    { action: 'click "Send"', perform: (page: Page) => page.getByTestId("send-message").click() },
    { action: "press Enter", perform: (page: Page) => page.getByTestId("message-input").press("Enter") },
  ];

  for (const { action, perform } of sendActions) {
    test(`A sent message is shown in the chat (AC-51): ${action}`, async ({ page }) => {
      await givenOpenChat(page, "Trip planning");
      await test.step('When I type "Hello, who are you?" in "Message"', async () => {
        await page.getByTestId("message-input").fill("Hello, who are you?");
      });
      await test.step(`And I ${action}`, async () => {
        await perform(page);
      });
      await thenMessagesLogShows(page, "Then", '"Hello, who are you?"', "Hello, who are you?");
      await test.step('And the "Message" field is empty', async () => {
        await expect(page.getByTestId("message-input")).toHaveValue("");
      });
    });
  }

  test("Shift+Enter adds a new line without sending", async ({ page }) => {
    const chat = await givenOpenChat(page, "Trip planning");
    const sendRequests = trackRequests(page, isSendMessageRequest(chat.id));
    await test.step('When I type "First line" in "Message"', async () => {
      await page.getByTestId("message-input").fill("First line");
    });
    await test.step("And I press Shift+Enter", async () => {
      await page.getByTestId("message-input").press("Shift+Enter");
    });
    await test.step('Then the "Message" field still contains "First line"', async () => {
      await expect(page.getByTestId("message-input")).toHaveValue(/^First line\n$/);
    });
    await andStillNoMessages(page);
    await andNoMessageRequest(sendRequests);
  });

  for (const text of ["", "   "]) {
    test(`A blank message cannot be sent: "${text}"`, async ({ page }) => {
      const chat = await givenOpenChat(page, "Trip planning");
      const sendRequests = trackRequests(page, isSendMessageRequest(chat.id));
      await test.step(`When I type "${text}" in "Message"`, async () => {
        await page.getByTestId("message-input").fill(text);
      });
      await test.step('Then the "Send" button is disabled', async () => {
        await expect(page.getByTestId("send-message")).toBeDisabled();
      });
      await andStillNoMessages(page);
      await andNoMessageRequest(sendRequests);
    });
  }

  test("A sent message is persisted immediately (AC-51)", { tag: "@api" }, async ({ page }) => {
    const chat = await test.step('Given I have a chat "Trip planning"', async () => createChat(page, "Trip planning"));
    const sent = await test.step('When I request POST "/chats/<id>/messages" with content "Hello, who are you?"', async () => {
      return sendMessage(page, chat.id, "Hello, who are you?");
    });
    await test.step('Then GET "/chats/<id>/messages" returns that message with role "user" and status "sent"', async () => {
      const messages = await listMessages(page, chat.id);
      const stored = messages.find((m) => m.id === sent.id);
      expect(stored).toMatchObject({ role: "user", status: "sent", content: "Hello, who are you?" });
    });
  });

  test("The response streams into the chat (AC-52)", async ({ page }) => {
    await givenOpenChat(page, "Trip planning", longReplyModel);
    await test.step('When I send the message "Write a very long story."', async () => {
      await page.getByTestId("message-input").fill("Write a very long story.");
      await page.getByTestId("send-message").click();
    });
    await test.step('Then I see the status "Generating…" and a "Stop" button', async () => {
      await expect(page.getByTestId("generating")).toHaveText("Generating…");
      await expect(page.getByTestId("stop-response")).toHaveText("Stop");
    });
    await test.step("And the assistant reply grows as text arrives", async () => {
      const reply = page.getByTestId("assistant-reply");
      await expect(reply).not.toBeEmpty();
      const before = (await reply.innerText()).length;
      await expect.poll(async () => (await reply.innerText()).length).toBeGreaterThan(before);
    });
    await thenGeneratingAndStopDisappear(page, 'And "Generating…" and "Stop" disappear when the reply is complete');
  });

  test("Stop a response mid-stream (AC-54)", async ({ page }) => {
    await givenOpenChat(page, "Trip planning", longReplyModel);
    await test.step('And a reply to "Write a very long story." is showing "Generating…"', async () => {
      await sendFromComposer(page, "Write a very long story.");
      await expect(page.getByTestId("generating")).toHaveText("Generating…");
      // Some of the reply has arrived, so there is a partial reply to keep.
      await expect(page.getByTestId("assistant-reply")).not.toBeEmpty();
    });
    await test.step('When I click "Stop"', async () => {
      await page.getByTestId("stop-response").click();
    });
    await thenGeneratingAndStopDisappear(page, 'Then "Generating…" and "Stop" disappear');
    const partial = await test.step('And the partial reply stays in the "Messages" log', async () => {
      const reply = page.getByTestId("messages").getByTestId("assistant-reply");
      await expect(reply).toHaveCount(1);
      await expect(reply).not.toBeEmpty();
      // The saved content is re-read from the server once the stop is acknowledged.
      await page.waitForLoadState("networkidle");
      return reply.innerText();
    });
    await test.step("And the same partial reply is shown after a page reload", async () => {
      await page.reload();
      await expect(page.getByTestId("messages").getByTestId("assistant-reply")).toHaveText(partial);
    });
  });

  test("A completed response reappears after a reload (AC-55)", async ({ page }) => {
    await givenOpenChat(page, "Trip planning");
    const replyText = await test.step('And the reply to "Hello, who are you?" is complete', async () => {
      await sendFromComposer(page, "Hello, who are you?");
      await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 15_000 });
      const reply = page.getByTestId("messages").getByTestId("assistant-reply");
      await expect(reply).not.toBeEmpty();
      return reply.innerText();
    });
    await test.step("When I reload the page", async () => {
      await page.reload();
      await expect(page.getByTestId("chat-heading")).toHaveText("Trip planning");
    });
    await test.step('Then the "Messages" log shows the same reply text as before the reload', async () => {
      await expect(page.getByTestId("messages").getByTestId("assistant-reply")).toHaveText(replyText);
    });
  });

  test("The full history is sent to the LLM as context (AC-53)", { tag: "@api" }, async ({ page }) => {
    const run = randomUUID();
    const history = await test.step("Given a chat with two completed user/assistant exchanges", async () => {
      const chat = await createChat(page, "Trip planning");
      const first = await exchange(page, chat.id, `First question ${run}`);
      const second = await exchange(page, chat.id, `Second question ${run}`);
      expect([first.reply.status, second.reply.status]).toEqual(["sent", "sent"]);
      // A reply that failed (the mock's error scenario) is also in the chat, so the last
      // step can check that failed messages are left out of the context.
      await updateChatModel(page, chat.id, failingModel);
      const failed = await exchange(page, chat.id, `Failing question ${run}`);
      expect(failed.reply.status).toBe("failed");
      await updateChatModel(page, chat.id, defaultModel);
      return { chat, first, second, failed };
    });
    const third = `Third question ${run}`;
    const queued = `Queued question ${run}`;
    await test.step("When I send a third message", async () => {
      const message = await sendMessage(page, history.chat.id, third);
      // Sent while the third is being answered, so it is queued when the context is built.
      await sendMessage(page, history.chat.id, queued);
      await waitForReply(page, history.chat.id, message.id);
    });
    const sentToProvider = await test.step(
      "Then the request to the provider contains all earlier messages in order, followed by the third message",
      async () => {
        const requests = await providerRequests(page);
        const forThird = requests
          .map((r) => r.body.messages.map((m) => ({ role: m.role, content: providerMessageText(m) })))
          .filter((messages) => messages.at(-1)?.content === third);
        expect(forThird).toHaveLength(1);
        const messages = forThird[0] ?? [];
        // The question whose reply failed was sent, so it is part of the history; its failed reply is not.
        expect(messages.filter((m) => m.role !== "system")).toEqual([
          { role: "user", content: history.first.message.content },
          { role: "assistant", content: history.first.reply.content },
          { role: "user", content: history.second.message.content },
          { role: "assistant", content: history.second.reply.content },
          { role: "user", content: history.failed.message.content },
          { role: "user", content: third },
        ]);
        return messages;
      },
    );
    await test.step("And it does not contain failed or queued messages", async () => {
      const contents = sentToProvider.map((m) => m.content);
      expect(contents).not.toContain(history.failed.reply.content);
      expect(contents).not.toContain(queued);
      expect(sentToProvider.filter((m) => m.role === "assistant" && m.content === "")).toEqual([]);
    });
  });
});
