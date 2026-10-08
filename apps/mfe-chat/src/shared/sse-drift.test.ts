import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chat } from "@app/shared-types";
import { describe, expect, it } from "vitest";
import type { SSEEvent } from "./types";

/**
 * Drift guard for the stream events (AICHAT-113, docs/AICHAT-20/SSE-DRIFT.md).
 *
 * mfe-chat declares its own `SSEEvent` (src/shared/types.ts) instead of using the
 * `SseEvent` of `@platform/shared-types`, and the two have drifted. This test pins the
 * drift as it is today. It fails when either definition changes, so nobody changes one
 * side without noticing. When the chat owner fixes the drift (mfe-chat imports the shared
 * type, or shared-types gets `message` and `started`), update the expectations below on
 * purpose and delete the part that no longer applies.
 */

type EventType = SSEEvent["type"];
type FieldsOf<K extends EventType> = keyof Extract<SSEEvent, { type: K }>;

/** Field names of every mfe-chat event. The type checks make a missing or unknown name a compile error. */
const mfeChatFields = {
  message: ["type", "message"],
  queued: ["type", "messageId"],
  started: ["type", "messageId"],
  token: ["type", "messageId", "token"],
  reasoning: ["type", "messageId", "token"],
  web_fetch: ["type", "messageId", "fetch"],
  done: ["type", "messageId", "stopped"],
  error: ["type", "messageId", "message", "retryable"],
} as const satisfies { [K in EventType]: readonly FieldsOf<K>[] };

type UnlistedFields = {
  [K in EventType]: Exclude<FieldsOf<K>, (typeof mfeChatFields)[K][number]>;
}[EventType];
const everyMfeChatFieldIsListed: [UnlistedFields] extends [never] ? true : never = true;

function sharedTypesFields(): Record<string, string[]> {
  const entries = chat.sseEventSchema.options.map((option) => [
    option.shape.type.value as string,
    Object.keys(option.shape),
  ]);
  return Object.fromEntries(entries) as Record<string, string[]>;
}

function compare(mfe: Record<string, readonly string[]>, shared: Record<string, readonly string[]>) {
  const onlyInMfeChat = Object.keys(mfe).filter((type) => !(type in shared));
  const onlyInSharedTypes = Object.keys(shared).filter((type) => !(type in mfe));
  const fieldDifferences: Record<string, { onlyInMfeChat: string[]; onlyInSharedTypes: string[] }> = {};
  for (const type of Object.keys(mfe).filter((t) => t in shared)) {
    const a = mfe[type] ?? [];
    const b = shared[type] ?? [];
    const diff = {
      onlyInMfeChat: a.filter((field) => !b.includes(field)),
      onlyInSharedTypes: b.filter((field) => !a.includes(field)),
    };
    if (diff.onlyInMfeChat.length > 0 || diff.onlyInSharedTypes.length > 0) {
      fieldDifferences[type] = diff;
    }
  }
  return { onlyInMfeChat, onlyInSharedTypes, fieldDifferences };
}

describe("SSE event drift between mfe-chat and shared-types", () => {
  it("lists every field of the mfe-chat events", () => {
    expect(everyMfeChatFieldIsListed).toBe(true);
  });

  it("pins today's drift: event names and fields that differ", () => {
    expect(compare(mfeChatFields, sharedTypesFields())).toMatchInlineSnapshot(`
      {
        "fieldDifferences": {
          "done": {
            "onlyInMfeChat": [
              "stopped",
            ],
            "onlyInSharedTypes": [],
          },
          "error": {
            "onlyInMfeChat": [
              "retryable",
            ],
            "onlyInSharedTypes": [],
          },
          "queued": {
            "onlyInMfeChat": [],
            "onlyInSharedTypes": [
              "position",
            ],
          },
        },
        "onlyInMfeChat": [
          "message",
          "started",
        ],
        "onlyInSharedTypes": [],
      }
    `);
  });
});

/**
 * AICHAT-188: mfe-chat's `SSEEvent` against what conversation-service really sends. The server
 * side is read from its generated OpenAPI spec (`SseEvent`, built from the same `sseEventSchema`
 * its stream test parses every event with), so no service code is imported here. Unlike the
 * shared-types comparison above, these two must agree exactly: a difference fails the build.
 */
type OptionalFieldsOf<K extends EventType> = {
  [F in FieldsOf<K>]-?: object extends Pick<Extract<SSEEvent, { type: K }>, F> ? F : never;
}[FieldsOf<K>];

/** Optional fields of every mfe-chat event; the type check keeps the list exact. */
const mfeChatOptionalFields = {
  message: [],
  queued: [],
  started: [],
  token: [],
  reasoning: [],
  web_fetch: [],
  done: ["stopped"],
  error: [],
} as const satisfies { [K in EventType]: readonly OptionalFieldsOf<K>[] };
type UnlistedOptional = {
  [K in EventType]: Exclude<OptionalFieldsOf<K>, (typeof mfeChatOptionalFields)[K][number]>;
}[EventType];
const everyOptionalFieldIsListed: [UnlistedOptional] extends [never] ? true : never = true;

interface ServerEventSchema {
  properties: { type: { enum: string[] } } & Record<string, unknown>;
  required: string[];
}

function serverEvents(): Record<string, { fields: string[]; required: string[] }> {
  const spec = JSON.parse(
    // Tests run from apps/mfe-chat (the jsdom environment gives no file: URL for this module).
    readFileSync(resolve(process.cwd(), "../../services/conversation-service/openapi.json"), "utf-8"),
  ) as { components: { schemas: { SseEvent: { oneOf: ServerEventSchema[] } } } };
  return Object.fromEntries(
    spec.components.schemas.SseEvent.oneOf.map((event) => [
      event.properties.type.enum[0],
      { fields: Object.keys(event.properties).sort(), required: [...event.required].sort() },
    ]),
  );
}

function mfeChatEvents(): Record<string, { fields: string[]; required: string[] }> {
  return Object.fromEntries(
    (Object.keys(mfeChatFields) as EventType[]).map((type) => {
      const optional: readonly string[] = mfeChatOptionalFields[type];
      const fields = [...mfeChatFields[type]].sort();
      return [type, { fields, required: fields.filter((field) => !optional.includes(field)) }];
    }),
  );
}

describe("SSE events: mfe-chat against conversation-service (AICHAT-188)", () => {
  it("lists every optional field of the mfe-chat events", () => {
    expect(everyOptionalFieldIsListed).toBe(true);
  });

  it("handles exactly the events the server sends, with the same fields and the same required fields", () => {
    expect(mfeChatEvents()).toEqual(serverEvents());
  });
});
