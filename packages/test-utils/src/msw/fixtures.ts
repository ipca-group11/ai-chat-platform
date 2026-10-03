// The data-factories entry of the mock server holds no server code (AICHAT-144), but the project is tagged as an app.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createFactories } from "@platform/mock-server";

// Data for the default handlers, built with the mock-server factories. The seed is fixed, so
// ids, texts and dates are the same on every run and a test can assert on them.
const factories = createFactories("test-utils");

const user = factories.user({ id: "user_00001", email: "user@example.test" });
const chat = factories.chat({
  id: "chat_00001",
  ownerId: user.id,
  title: "Trip planning",
  provider: "anthropic",
  model: "claude-haiku-4-5",
});
const userMessage = factories.userMessage({ id: "msg_00001", chatId: chat.id, content: "Hello" });
const assistantMessage = factories.assistantMessage({
  id: "msg_00002",
  chatId: chat.id,
  content: "Hi, how can I help?",
  status: "complete",
});
const guest = factories.member({ chatId: chat.id, email: "guest@example.test", role: "member" });
const attachment = factories.attachment({
  id: "att_00001",
  messageId: userMessage.id,
  ownerId: user.id,
  originalFilename: "notes.txt",
  mimeType: "text/plain",
});

/** Default data of the handlers. Override a response in a test with `server.use(...)` instead of editing these. */
export const fixtures = { factories, user, chat, userMessage, assistantMessage, guest, attachment };
