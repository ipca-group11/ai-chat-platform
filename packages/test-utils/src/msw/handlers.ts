import { http, HttpResponse } from "msw";
import { toAttachmentDto, toChatDto, toMessageDto } from "./dto";
import { fixtures } from "./fixtures";

// Default handlers for the HTTP APIs the microfrontends call. Paths start with `*` so they match
// whatever base URL the code under test uses (same origin, `/api`, a configured service URL).
// Bodies follow what the services send: conversation-service wraps each body in a one-key
// envelope (`{ chat }`, `{ chats }`, `{ messages }`, ...), auth-service sends the user directly.
//
// Override one response in a test with `server.use(http.get("*/chats", () => ...))`; the
// override is dropped after the test by `@platform/test-utils/setup`.

const { user, chat, userMessage, assistantMessage, guest, attachment } = fixtures;
const noContent = () => new HttpResponse(null, { status: 204 });
const bodyOf = async (request: Request): Promise<Record<string, unknown>> => {
  const text = await request.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
};

/** auth-service: register, login, refresh, logout and the current user. */
export const authHandlers = [
  http.post("*/auth/register", async ({ request }) => {
    const { email = user.email } = await bodyOf(request);
    return HttpResponse.json({ id: user.id, email }, { status: 201 });
  }),
  http.post("*/auth/login", async ({ request }) => {
    const { email = user.email } = await bodyOf(request);
    return HttpResponse.json({ id: user.id, email });
  }),
  http.post("*/auth/refresh", noContent),
  http.post("*/auth/logout", noContent),
  http.get("*/auth/me", () => HttpResponse.json({ id: user.id, email: user.email })),
];

/** conversation-service: chats and their members. */
export const chatHandlers = [
  http.get("*/chats", () => HttpResponse.json({ chats: [toChatDto(chat)] })),
  http.post("*/chats", async ({ request }) => {
    const body = await bodyOf(request);
    return HttpResponse.json({ chat: toChatDto({ ...chat, id: "chat_new", ...body } as typeof chat) }, { status: 201 });
  }),
  http.get("*/chats/:chatId", ({ params }) =>
    HttpResponse.json({ chat: toChatDto({ ...chat, id: String(params.chatId) }) }),
  ),
  http.patch("*/chats/:chatId", async ({ params, request }) => {
    const body = await bodyOf(request);
    return HttpResponse.json({ chat: toChatDto({ ...chat, ...body, id: String(params.chatId) } as typeof chat) });
  }),
  http.delete("*/chats/:chatId", noContent),
  http.get("*/chats/:chatId/members", () =>
    HttpResponse.json({
      members: [
        { email: user.email, role: "owner", addedAt: chat.createdAt },
        { email: guest.email, role: guest.role, addedAt: guest.addedAt },
      ],
    }),
  ),
  http.post("*/chats/:chatId/members", async ({ request }) => {
    const { email = guest.email } = await bodyOf(request);
    return HttpResponse.json({ member: { email, role: "member", addedAt: guest.addedAt } }, { status: 201 });
  }),
  http.delete("*/chats/:chatId/members/:email", noContent),
  http.delete("*/chats/:chatId/membership", noContent),
];

/** conversation-service: messages of a chat, queue actions and attachments. */
export const messageHandlers = [
  http.get("*/chats/:chatId/messages", ({ params }) =>
    HttpResponse.json({
      messages: [
        toMessageDto({ ...userMessage, chatId: String(params.chatId) }, [attachment]),
        toMessageDto({ ...assistantMessage, chatId: String(params.chatId) }),
      ],
    }),
  ),
  http.post("*/chats/:chatId/messages", async ({ params, request }) => {
    const { content = userMessage.content } = await bodyOf(request);
    return HttpResponse.json(
      { message: toMessageDto({ ...userMessage, id: "msg_new", chatId: String(params.chatId), content: String(content) }) },
      { status: 201 },
    );
  }),
  http.patch("*/chats/:chatId/messages/:messageId", async ({ params, request }) => {
    const { content = userMessage.content } = await bodyOf(request);
    return HttpResponse.json({
      message: toMessageDto({
        ...userMessage,
        id: String(params.messageId),
        chatId: String(params.chatId),
        content: String(content),
        status: "queued",
      }),
    });
  }),
  http.delete("*/chats/:chatId/messages/:messageId", noContent),
  http.post("*/chats/:chatId/messages/:messageId/retry", ({ params }) =>
    HttpResponse.json(
      { message: toMessageDto({ ...assistantMessage, id: String(params.messageId), chatId: String(params.chatId), status: "queued" }) },
      { status: 202 },
    ),
  ),
  http.post("*/chats/:chatId/messages/:messageId/stop", () => HttpResponse.json({ stopped: true })),
  http.post("*/chats/:chatId/stop", () => HttpResponse.json({ stopped: true })),
  http.post("*/chats/:chatId/attachments", () =>
    HttpResponse.json({ attachment: toAttachmentDto(attachment) }, { status: 201 }),
  ),
];

/** conversation-service: the "Test connection" action of the settings page (the key travels in `X-Llm-Api-Key`). */
export const settingsHandlers = [
  http.post("*/providers/:provider/test-connection", ({ request }) => {
    if (!request.headers.get("X-Llm-Api-Key")) {
      return HttpResponse.json({ success: false, message: "No API key was provided." });
    }
    return HttpResponse.json({ success: true });
  }),
];

export const handlers = [...authHandlers, ...chatHandlers, ...messageHandlers, ...settingsHandlers];
