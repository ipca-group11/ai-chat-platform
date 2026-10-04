import express, { Router, type Request, type RequestHandler, type Response } from "express";
import type { chat } from "@app/shared-types";
import { currentUser } from "../auth/sessions.js";
import { jsonBody } from "../core/request-log.js";
import { cors, errorHandler, fieldErrorsOf, HttpError } from "../backend/http.js";
import { isAnswerScenario, ANSWER_SCENARIOS } from "../conversation/answer-text.js";
import {
  addMemberSchema,
  createChatSchema,
  editMessageSchema,
  providerSchema,
  sendMessageSchema,
  updateChatSchema,
} from "../conversation/contract.js";
import { engineFor } from "../conversation/engine.js";
import {
  accessibleChat,
  findMessage,
  membersOf,
  messagesOf,
  nextId,
  nowIso,
  ownedChat,
  removeChat,
  toAttachmentDto,
  toChatDto,
  toMessageDto,
  type StoredMessage,
} from "../conversation/records.js";
import { faultInjector, FAULT_SCENARIOS, STREAM_DROP_AFTER_EVENTS, type FaultScenario } from "../faults/faults.js";
import type { MockUser } from "../data/types.js";
import type { MockContext, MockModule } from "../registry.js";
import type { ZodType } from "zod";

const FAULT_DESCRIPTIONS: Record<FaultScenario, string> = {
  "session-expired": "401 UNAUTHENTICATED, as when the access token has expired",
  "error-500": "500 INTERNAL_ERROR",
  slow: "Answer is held back (3 s, or delayMs of the fault)",
  "stream-drop": "The chat stream is cut after a few events",
};

const SCENARIO_HEADER = "x-mock-scenario";
// HTTP header name, not a secret (AICHAT-27 WAIVERS.md W2)
// nosemgrep: node_api_key
const API_KEY_HEADER = "x-llm-api-key";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILES = [
  { extension: ".txt", mimeType: "text/plain" },
  { extension: ".pdf", mimeType: "application/pdf" },
  { extension: ".png", mimeType: "image/png" },
  { extension: ".jpeg", mimeType: "image/jpeg" },
  { extension: ".jpg", mimeType: "image/jpeg" },
] as const;

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request validation failed", fieldErrorsOf(parsed.error));
  }
  return parsed.data;
}

const param = (req: Request, name: string): string => String(req.params[name] ?? "");

/** The scenario of the answer a send or retry starts; `ok` unless the header names another. */
function scenarioOf(req: Request) {
  const header = req.headers[SCENARIO_HEADER];
  const value = (Array.isArray(header) ? header[0] : header)?.trim();
  return isAnswerScenario(value) ? value : "ok";
}

/** conversation-service mock: chats, members, messages, the chat SSE stream, attachments, key tests. */
function createConversationRouter(ctx: MockContext): Router {
  const router = Router();
  const engine = engineFor(ctx);
  const userOf = (res: Response): MockUser => res.locals.user as MockUser;

  router.use(cors);
  router.use(faultInjector(ctx, { unauthenticated: "Missing or invalid access token", internal: "An unexpected error occurred" }));
  router.use(jsonBody());

  router.use((req, res, next) => {
    const user = currentUser(ctx, req);
    if (!user) {
      next(new HttpError(401, "UNAUTHENTICATED", "Missing or invalid access token"));
      return;
    }
    res.locals.user = user;
    next();
  });

  // --- chats ---------------------------------------------------------------------------
  router.get("/chats", (_req, res) => {
    const user = userOf(res);
    const invited = new Set(
      ctx.store.data.members.filter((m) => m.role === "member" && m.email === user.email).map((m) => m.chatId),
    );
    const chats = ctx.store.data.chats
      .filter((c) => c.ownerId === user.id || invited.has(c.id))
      .map((c, index) => ({ c, index }))
      .sort((a, b) => b.c.updatedAt.localeCompare(a.c.updatedAt) || a.index - b.index)
      .map(({ c }) => toChatDto(ctx, c));
    res.json({ chats });
  });

  router.post("/chats", (req, res) => {
    const user = userOf(res);
    const input = parse(createChatSchema, req.body);
    const now = nowIso();
    const created = {
      id: nextId(ctx, "chat", ctx.store.data.chats.map((c) => c.id)),
      ownerId: user.id,
      title: input.title,
      provider: input.provider,
      model: input.model,
      reasoning: input.reasoning ?? false,
      webFetch: input.webFetch ?? false,
      createdAt: now,
      updatedAt: now,
    };
    ctx.store.data.chats.push(created);
    ctx.store.data.members.push({ chatId: created.id, email: user.email, role: "owner", addedAt: now });
    res.status(201).json({ chat: toChatDto(ctx, created) });
  });

  router.get("/chats/:id", (req, res) => {
    res.json({ chat: toChatDto(ctx, accessibleChat(ctx, userOf(res), param(req, "id"))) });
  });

  router.patch("/chats/:id", (req, res) => {
    const target = ownedChat(ctx, userOf(res), param(req, "id"));
    Object.assign(target, parse(updateChatSchema, req.body), { updatedAt: nowIso() });
    res.json({ chat: toChatDto(ctx, target) });
  });

  router.delete("/chats/:id", (req, res) => {
    const target = ownedChat(ctx, userOf(res), param(req, "id"));
    engine.drop(target.id);
    removeChat(ctx, target.id);
    res.status(204).send();
  });

  // --- members -------------------------------------------------------------------------
  router.get("/chats/:id/members", (req, res) => {
    res.json({ members: membersOf(ctx, accessibleChat(ctx, userOf(res), param(req, "id"))) });
  });

  router.post("/chats/:id/members", (req, res) => {
    const user = userOf(res);
    const target = ownedChat(ctx, user, param(req, "id"));
    const { email } = parse(addMemberSchema, req.body);
    if (email === user.email) throw new HttpError(400, "CANNOT_INVITE_SELF", "You already own this chat");
    if (membersOf(ctx, target).some((member) => member.email === email)) {
      throw new HttpError(409, "ALREADY_A_MEMBER", "That user is already a member of this chat");
    }
    const member = { chatId: target.id, email, role: "member" as const, addedAt: nowIso() };
    ctx.store.data.members.push(member);
    res.status(201).json({ member: { email, role: "member", addedAt: member.addedAt } });
  });

  const removeMember = (req: Request, res: Response, email: string): void => {
    const user = userOf(res);
    const target = accessibleChat(ctx, user, param(req, "id"));
    if (target.ownerId !== user.id && email !== user.email) {
      throw new HttpError(403, "FORBIDDEN", "Only the chat owner can remove other members");
    }
    const members = ctx.store.data.members;
    const index = members.findIndex((m) => m.chatId === target.id && m.role === "member" && m.email === email);
    if (index < 0) throw new HttpError(404, "MEMBER_NOT_FOUND", "Member not found");
    members.splice(index, 1);
    res.status(204).send();
  };
  router.delete("/chats/:id/members/:email", (req, res) => {
    removeMember(req, res, param(req, "email").trim().toLowerCase());
  });
  router.delete("/chats/:id/membership", (req, res) => {
    const user = userOf(res);
    if (accessibleChat(ctx, user, param(req, "id")).ownerId === user.id) {
      throw new HttpError(409, "OWNER_CANNOT_LEAVE", "The chat owner cannot leave their own chat. Delete the chat instead.");
    }
    removeMember(req, res, user.email);
  });

  // --- messages ------------------------------------------------------------------------
  router.get("/chats/:chatId/messages", (req, res) => {
    const target = accessibleChat(ctx, userOf(res), param(req, "chatId"));
    res.json({ messages: messagesOf(ctx, target.id).map((m) => toMessageDto(ctx, m)) });
  });

  router.post("/chats/:chatId/messages", (req, res) => {
    const user = userOf(res);
    const target = accessibleChat(ctx, user, param(req, "chatId"));
    const input = parse(sendMessageSchema, req.body);
    const owned = ctx.store.data.attachments.filter((a) => input.attachmentIds.includes(a.id) && a.ownerId === user.id);
    const record: StoredMessage = {
      id: nextId(ctx, "msg", ctx.store.data.messages.map((m) => m.id)),
      chatId: target.id,
      role: "user",
      content: input.content,
      status: engine.isBusy(target.id) ? "queued" : "complete",
      attachmentIds: owned.map((a) => a.id),
      createdAt: nowIso(),
      authorId: user.id,
      authorEmail: user.email,
    };
    ctx.store.data.messages.push(record);
    for (const attachment of owned) attachment.messageId = record.id;

    engine.publish(target.id, { type: "message", message: toMessageDto(ctx, record) });
    if (record.status === "queued") engine.publish(target.id, { type: "queued", messageId: record.id });
    engine.submit(target.id, { messageId: record.id, kind: "send", scenario: scenarioOf(req) });
    res.status(201).json({ message: toMessageDto(ctx, record) });
  });

  /** A queued message of the signed-in user; 404 when it is not theirs, 409 once it started. */
  const queuedOwnMessage = (req: Request, res: Response, conflict: [string, string]): StoredMessage => {
    const user = userOf(res);
    const target = accessibleChat(ctx, user, param(req, "chatId"));
    const record = findMessage(ctx, param(req, "messageId"));
    const author = record?.authorId ?? target.ownerId;
    if (!record || record.chatId !== target.id || record.role !== "user" || author !== user.id) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    }
    if (!engine.isQueued(target.id, record.id)) throw new HttpError(409, conflict[0], conflict[1]);
    return record;
  };

  router.patch("/chats/:chatId/messages/:messageId", (req, res) => {
    const record = queuedOwnMessage(req, res, ["MESSAGE_NOT_EDITABLE", "Message is not queued and can no longer be edited"]);
    record.content = parse(editMessageSchema, req.body).content;
    res.json({ message: toMessageDto(ctx, record) });
  });

  router.delete("/chats/:chatId/messages/:messageId", (req, res) => {
    const record = queuedOwnMessage(req, res, [
      "MESSAGE_NOT_CANCELABLE",
      "Message is not queued and can no longer be canceled",
    ]);
    engine.cancelQueued(record.chatId, record.id);
    ctx.store.data.messages = ctx.store.data.messages.filter((m) => m.id !== record.id);
    res.status(204).send();
  });

  router.post("/chats/:chatId/messages/:messageId/retry", (req, res) => {
    const target = accessibleChat(ctx, userOf(res), param(req, "chatId"));
    const record = findMessage(ctx, param(req, "messageId"));
    if (!record || record.chatId !== target.id) throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    if (record.role !== "assistant" || record.status !== "failed") {
      throw new HttpError(409, "MESSAGE_NOT_RETRYABLE", "Only a failed assistant message can be retried");
    }
    Object.assign(record, { content: "", reasoning: null, webFetches: undefined, status: "queued", error: null });
    const queued = toMessageDto(ctx, record);
    engine.submit(target.id, { messageId: record.id, kind: "retry", scenario: scenarioOf(req) });
    res.status(202).json({ message: queued });
  });

  const stop = (req: Request, res: Response): void => {
    const target = accessibleChat(ctx, userOf(res), param(req, "chatId"));
    res.json({ stopped: engine.stop(target.id) });
  };
  router.post("/chats/:chatId/stop", stop);
  // The chat app calls the stop of one message; both stop the chat's answer.
  router.post("/chats/:chatId/messages/:messageId/stop", stop);

  // --- chat stream (SSE) ---------------------------------------------------------------
  router.get("/chats/:chatId/stream", (req, res) => {
    const target = accessibleChat(ctx, userOf(res), param(req, "chatId"));
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const dropping = (res.locals.fault as { scenario?: string } | undefined)?.scenario === "stream-drop";
    let delivered = 0;
    const unsubscribe = engine.subscribe(target.id, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      delivered += 1;
      if (dropping && delivered >= STREAM_DROP_AFTER_EVENTS) {
        unsubscribe();
        // flush what was written, then cut the socket without ending the chunked body
        res.socket?.destroySoon();
      }
    });
    req.on("close", unsubscribe);
  });

  // --- attachments ---------------------------------------------------------------------
  const upload = (req: Request, res: Response, messageIdParam: string | undefined): void => {
    const user = userOf(res);
    const target = accessibleChat(ctx, user, param(req, "chatId"));
    let messageId = "pending";
    if (messageIdParam !== undefined) {
      const record = findMessage(ctx, messageIdParam);
      if (!record || record.chatId !== target.id || (record.authorId ?? target.ownerId) !== user.id) {
        throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
      }
      messageId = record.id;
    }
    const body: unknown = req.body;
    const raw = Buffer.isBuffer(body) ? body.toString("latin1") : "";
    const name = /filename="([^"]*)"/.exec(raw)?.[1];
    if (!name) throw new HttpError(400, "ATTACHMENT_REQUIRED", "No file was provided");
    const mimeType = /filename="[^"]*"\r\nContent-Type:\s*([^\r\n]+)/i.exec(raw)?.[1]?.trim() ?? "";
    const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
    const allowed = ALLOWED_FILES.find((file) => file.extension === extension);
    if (!allowed) {
      throw new HttpError(
        400,
        "ATTACHMENT_TYPE_NOT_ALLOWED",
        `Files of type "${extension || "unknown"}" are not allowed. Accepted types: .txt, .pdf, .png, .jpeg, .jpg`,
      );
    }
    if (mimeType !== allowed.mimeType) {
      throw new HttpError(
        400,
        "ATTACHMENT_TYPE_NOT_ALLOWED",
        `File "${name}" has a MIME type ("${mimeType}") that does not match its extension`,
      );
    }
    const start = raw.indexOf("\r\n\r\n", raw.indexOf(name)) + 4;
    const size = Math.max(1, raw.lastIndexOf("\r\n--") - start);
    if (size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, "ATTACHMENT_TOO_LARGE", `File "${name}" exceeds the 10 MB size limit`);
    }
    const attachment: chat.Attachment = {
      id: nextId(ctx, "att", ctx.store.data.attachments.map((a) => a.id)),
      messageId,
      ownerId: user.id,
      originalFilename: name,
      storedPath: `uploads/${name}`,
      mimeType: allowed.mimeType,
      size,
      extractedTextStatus: allowed.mimeType.startsWith("image/") ? "not_applicable" : "extracted",
      createdAt: nowIso(),
    };
    ctx.store.data.attachments.push(attachment);
    res.status(201).json({ attachment: toAttachmentDto(attachment) });
  };
  const rawMultipart = express.raw({ type: "multipart/form-data", limit: "12mb" });
  // A body over the parser's own limit is also "too large" (413), like the service.
  const multipart: RequestHandler = (req, res, next) => {
    rawMultipart(req, res, (err?: unknown) => {
      if ((err as { type?: string } | undefined)?.type === "entity.too.large") {
        next(new HttpError(413, "ATTACHMENT_TOO_LARGE", "The file exceeds the upload size limit"));
        return;
      }
      next(err);
    });
  };
  router.post("/chats/:chatId/messages/:messageId/attachments", multipart, (req, res) => {
    upload(req, res, param(req, "messageId"));
  });
  // The chat app uploads before it sends: the file is linked to the message by `attachmentIds`.
  router.post("/chats/:chatId/attachments", multipart, (req, res) => {
    upload(req, res, undefined);
  });

  // --- provider key settings -----------------------------------------------------------
  router.post("/providers/:provider/test-connection", (req, res) => {
    const provider = providerSchema.safeParse(req.params.provider);
    if (!provider.success) throw new HttpError(404, "NOT_FOUND", "Resource not found");
    const key = String(req.headers[API_KEY_HEADER] ?? "");
    if (key.length === 0) {
      res.json({ success: false, message: "No API key was provided." });
    } else if (key.startsWith("invalid")) {
      res.json({ success: false, message: "The provider rejected the API key." });
    } else {
      res.json({ success: true });
    }
  });

  router.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "Resource not found"));
  });
  router.use(errorHandler("An unexpected error occurred"));
  return router;
}

/**
 * conversation-service mock, mounted on `/api` (the path the chat and settings apps call; the
 * shell proxy strips it before the real service sees `/chats`). Needs the session of the auth mock.
 */
export const conversationMock: MockModule = {
  name: "conversation",
  mountPath: "/api",
  scenarios: [
    ...FAULT_SCENARIOS.map((name) => ({ mock: "conversation", name, description: FAULT_DESCRIPTIONS[name] })),
    ...ANSWER_SCENARIOS.map((name) => ({
    mock: "conversation",
    name,
    description:
      name === "ok"
        ? "Streamed answer of TOKENS tokens (default)"
        : name === "long"
          ? "Streamed answer ten times as long (the LLM mock long scenario)"
          : "Answer fails after two tokens; the message ends as failed and can be retried",
    })),
  ],
  createRouter: createConversationRouter,
};
