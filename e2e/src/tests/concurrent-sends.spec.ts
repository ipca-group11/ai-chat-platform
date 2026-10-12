import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { llmRequestFor, type LlmRequest } from "../support/llm-mock.js";
import { registerAndLogIn, type Account } from "./support/auth.js";

/**
 * AICHAT-193, two members of a shared chat send at the same moment. Owner and member are two
 * browser contexts (separate cookies and sessionStorage, like two people on two computers).
 * Expected (AICHAT-189, S1/S2/S8): every message is shown once, as question, reply, question,
 * reply, in the same order for both members and after a reload; each question reaches the LLM
 * mock exactly once; a double-click on Send is one message. Runs against the `llm` compose
 * profile (pnpm mock:up): the replies come from the LLM mock.
 */

const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const ROUNDS = 3;

async function signedInPage(browser: Browser, prefix: string): Promise<{ page: Page; account: Account }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = await registerAndLogIn(page, prefix);
  // Each member replies with their own key, kept in this tab's sessionStorage.
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toHaveText(`••••${anthropicKey.slice(-4)}`);
  return { page, account };
}

/** The conversation as one member sees it: "Q:<text>" for a question, "A" for a finished reply. */
async function conversation(page: Page, questions: string[]): Promise<string[]> {
  const bubbles = page.getByTestId("messages").locator('[data-testid="user-message"], [data-testid="assistant-message"]');
  const shown: string[] = [];
  for (const bubble of await bubbles.all()) {
    if ((await bubble.getAttribute("data-testid")) === "assistant-message") {
      shown.push("A");
      continue;
    }
    const text = await bubble.innerText();
    shown.push(`Q:${questions.find((q) => text.includes(q)) ?? text}`);
  }
  return shown;
}

/** Waits until the view shows every question with its reply and nothing is generating. */
async function waitForAllReplies(page: Page, count: number) {
  await expect(page.getByTestId("messages").getByTestId("assistant-message")).toHaveCount(count, { timeout: 20_000 });
  await expect(page.getByTestId("generating")).toHaveCount(0, { timeout: 20_000 });
}

/** Every question once, each followed by a reply. */
function expectQuestionReplyPairs(shown: string[], questions: string[]) {
  expect(shown).toHaveLength(questions.length * 2);
  shown.forEach((item, i) => expect(item.startsWith("Q:") ? "Q" : "A", `item ${i} of [${shown.join(", ")}]`).toBe(i % 2 === 0 ? "Q" : "A"));
  expect(shown.filter((s) => s.startsWith("Q:")).map((s) => s.slice(2)).sort()).toEqual([...questions].sort());
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send-message").click();
}

test.describe("Concurrent sends in a shared chat (AICHAT-193)", () => {
  test("owner and member send at the same moment: both see each message once, in the same order", async ({ browser }) => {
    const owner = await signedInPage(browser, "owner");
    const member = await signedInPage(browser, "member");

    const created = await owner.page.request.post("/api/chats", { data: { title: "Shared at once", provider: "anthropic", model: "claude-haiku-4-5" } });
    expect(created.status()).toBe(201);
    const chatId = ((await created.json()) as { chat: { id: string } }).chat.id;
    expect((await owner.page.request.post(`/api/chats/${chatId}/members`, { data: { email: member.account.email } })).status()).toBe(201);

    for (const { page } of [owner, member]) {
      await page.goto(`/chats/${chatId}`);
      await expect(page.getByTestId("message-input")).toBeVisible();
    }

    const run = randomUUID().slice(0, 8);
    const questions: string[] = [];
    for (let round = 1; round <= ROUNDS; round += 1) {
      const fromOwner = `owner ${run} round ${round}`;
      const fromMember = `member ${run} round ${round}`;
      questions.push(fromOwner, fromMember);
      await Promise.all([send(owner.page, fromOwner), send(member.page, fromMember)]);
      await Promise.all([waitForAllReplies(owner.page, questions.length), waitForAllReplies(member.page, questions.length)]);
    }

    // Live views: the same conversation for both members.
    const ownerView = await conversation(owner.page, questions);
    const memberView = await conversation(member.page, questions);
    expectQuestionReplyPairs(ownerView, questions);
    expect(memberView).toEqual(ownerView);

    // After a reload (the order saved in the database), and the API agrees.
    for (const { page } of [owner, member]) {
      await page.reload();
      await waitForAllReplies(page, questions.length);
      expect(await conversation(page, questions)).toEqual(ownerView);
    }
    const listed = (await (await owner.page.request.get(`/api/chats/${chatId}/messages`)).json()) as { messages: Array<{ role: string; content: string }> };
    expect(listed.messages.map((m) => (m.role === "user" ? `Q:${m.content}` : "A"))).toEqual(ownerView);

    // Each question reached the LLM exactly once, and as the last thing it was asked.
    for (const question of questions) {
      const entry = (await llmRequestFor(owner.page.request, question)) as LlmRequest;
      expect(entry, `an LLM request for "${question}"`).toBeDefined();
      expect(entry.finishedAt, `the reply to "${question}" finished`).not.toBeNull();
      const asked = (entry.body.messages ?? []).filter((m) => m.role === "user").map((m) => JSON.stringify(m.content));
      expect(asked.filter((m) => m.includes(question)), `"${question}" sent to the LLM once per request`).toHaveLength(1);
      expect(asked.at(-1), `"${question}" is the last question of its request`).toContain(question);
    }

    await owner.page.context().close();
    await member.page.context().close();
  });

  test("a double-click on Send is one message and one reply", async ({ browser }) => {
    const { page } = await signedInPage(browser, "dblclick");
    const created = await page.request.post("/api/chats", { data: { title: "Double click", provider: "anthropic", model: "claude-haiku-4-5" } });
    const chatId = ((await created.json()) as { chat: { id: string } }).chat.id;
    await page.goto(`/chats/${chatId}`);

    const question = `double click ${randomUUID().slice(0, 8)}`;
    await page.getByTestId("message-input").fill(question);
    await page.getByTestId("send-message").dblclick();
    await waitForAllReplies(page, 1);

    expect(await conversation(page, [question])).toEqual([`Q:${question}`, "A"]);
    await page.reload();
    await waitForAllReplies(page, 1);
    expect(await conversation(page, [question])).toEqual([`Q:${question}`, "A"]);

    await page.context().close();
  });
});
