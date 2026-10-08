/**
 * Guard (AICHAT-183): the API schemas of this service live in `src/shared/contracts` and the
 * feature `schema.ts` files (the agreed source of truth). `packages/shared-types` keeps older
 * copies of the same DTOs. This test pins every known difference between the two, field by
 * field, so the drift recorded in docs/AICHAT-12/WORKLOG.md (US1) cannot grow or shrink
 * without someone updating that record and this list.
 */
import { chat as shared } from "@app/shared-types";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { addMemberSchema, createChatSchema, updateChatSchema } from "../../features/chats/schema.js";
import { editMessageSchema, sendMessageSchema } from "../../features/messages/schema.js";
import { attachmentDtoSchema, chatDtoSchema, chatMemberDtoSchema, messageDtoSchema } from "./chat.js";

interface ObjectJsonSchema {
  properties?: Record<string, unknown>;
  required?: string[];
}

function jsonSchemaOf(schema: z.ZodType): ObjectJsonSchema {
  return z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as ObjectJsonSchema;
}

/** One line per field that differs: only in the service, only in shared-types, a different
 * definition, or required on one side only. */
function fieldDrift(service: z.ZodType, sharedSchema: z.ZodType): string[] {
  const a = jsonSchemaOf(service);
  const b = jsonSchemaOf(sharedSchema);
  const fields = new Set([...Object.keys(a.properties ?? {}), ...Object.keys(b.properties ?? {})]);
  const lines: string[] = [];
  for (const field of [...fields].sort()) {
    const left = a.properties?.[field];
    const right = b.properties?.[field];
    if (right === undefined) lines.push(`${field}: only in service`);
    else if (left === undefined) lines.push(`${field}: only in shared-types`);
    else {
      if (JSON.stringify(left) !== JSON.stringify(right)) lines.push(`${field}: definition differs`);
      if ((a.required ?? []).includes(field) !== (b.required ?? []).includes(field)) lines.push(`${field}: required differs`);
    }
  }
  return lines;
}

describe("drift between the service contracts and packages/shared-types", () => {
  it.each([
    ["ChatDto", chatDtoSchema, shared.chatSchema],
    ["MessageDto", messageDtoSchema, shared.messageSchema],
    ["AttachmentDto", attachmentDtoSchema, shared.attachmentSchema],
    ["ChatMemberDto", chatMemberDtoSchema, shared.chatMemberSchema],
    ["create chat body", createChatSchema, shared.createChatRequestSchema],
    ["update chat body", updateChatSchema, shared.updateChatRequestSchema],
    ["add member body", addMemberSchema, shared.addChatMemberRequestSchema],
    ["send message body", sendMessageSchema, shared.sendMessageRequestSchema],
    ["edit message body", editMessageSchema, shared.editQueuedMessageRequestSchema],
  ] as const)("%s matches the recorded drift", (name, service, sharedSchema) => {
    expect(fieldDrift(service, sharedSchema)).toEqual(KNOWN_DRIFT[name]);
  });
});

/** The drift recorded in the US1 inventory. Empty list = the two copies agree. */
const KNOWN_DRIFT: Record<string, string[]> = {
  ChatDto: [
    "createdAt: definition differs", // shared-types requires an ISO date-time format
    "model: definition differs", // shared-types requires min length 1
    "ownerEmail: only in service",
    "title: definition differs", // shared-types: 1..200 characters
    "updatedAt: definition differs",
  ],
  MessageDto: [
    "attachmentIds: only in shared-types", // the service returns full attachment objects
    "attachments: only in service",
    "authorEmail: only in service",
    "authorId: only in service",
    "createdAt: definition differs",
    "error: only in service",
    "reasoning: required differs",
    "role: definition differs", // service also allows "system"
    "status: definition differs", // service: sent|queued|streaming|failed; shared: queued|streaming|complete|failed|canceled
    "stopped: only in service",
    "webFetches: required differs",
  ],
  AttachmentDto: [
    "createdAt: definition differs",
    "extractedTextStatus: only in shared-types",
    "filename: only in service",
    "kind: only in service",
    "mimeType: definition differs", // shared-types is an enum of four types
    "originalFilename: only in shared-types",
    "ownerId: only in shared-types",
    "size: definition differs",
    "storedPath: only in shared-types", // the service never exposes the storage path
  ],
  ChatMemberDto: ["addedAt: definition differs"],
  "create chat body": ["model: definition differs"], // service: max 200 characters
  "update chat body": ["model: definition differs"],
  "add member body": [],
  "send message body": [
    "attachmentIds: definition differs", // service: max 10 ids, default []
    "content: definition differs", // service: max 32 000 characters
  ],
  "edit message body": ["content: definition differs"],
};
