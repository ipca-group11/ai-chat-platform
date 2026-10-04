import { z } from "zod";
/**
 * Events of `GET /chats/:id/stream`, exactly as conversation-service sends them (AICHAT-221,
 * docs/AICHAT-20/SSE-DRIFT.md). The service publishes these types, mfe-chat parses them and the
 * mock server is checked against them, so the three can no longer drift apart.
 *
 * Self-contained on purpose (only `zod`, no relative imports): conversation-service loads the
 * compiled output of this file with plain Node ESM (`@app/shared-types/stream-events`), like
 * `model-capabilities.ts`.
 */
/** A page the model fetched while writing a reply. `fetching` only appears while the reply is
 * streaming; saved replies hold `done` or `error`. */
export declare const webFetchSchema: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    status: z.ZodEnum<{
        fetching: "fetching";
        done: "done";
        error: "error";
    }>;
    title: z.ZodOptional<z.ZodString>;
    errorCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WebFetch = z.infer<typeof webFetchSchema>;
/** A file attached to a message, as conversation-service returns it. */
export declare const attachmentDtoSchema: z.ZodObject<{
    id: z.ZodString;
    messageId: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    kind: z.ZodEnum<{
        text: "text";
        pdf: "pdf";
        image: "image";
    }>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type AttachmentDto = z.infer<typeof attachmentDtoSchema>;
/** A message as conversation-service returns it (and sends it in the `message` event). */
export declare const messageDtoSchema: z.ZodObject<{
    id: z.ZodString;
    chatId: z.ZodString;
    authorId: z.ZodString;
    authorEmail: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
        system: "system";
    }>;
    content: z.ZodString;
    reasoning: z.ZodNullable<z.ZodString>;
    webFetches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        status: z.ZodEnum<{
            fetching: "fetching";
            done: "done";
            error: "error";
        }>;
        title: z.ZodOptional<z.ZodString>;
        errorCode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        messageId: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        size: z.ZodNumber;
        kind: z.ZodEnum<{
            text: "text";
            pdf: "pdf";
            image: "image";
        }>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        sent: "sent";
        queued: "queued";
        streaming: "streaming";
        failed: "failed";
    }>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    truncated: z.ZodBoolean;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type MessageDto = z.infer<typeof messageDtoSchema>;
/** A user message was posted, so every member viewing the chat sees it live. */
export declare const sseMessageEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"message">;
    message: z.ZodObject<{
        id: z.ZodString;
        chatId: z.ZodString;
        authorId: z.ZodString;
        authorEmail: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
            system: "system";
        }>;
        content: z.ZodString;
        reasoning: z.ZodNullable<z.ZodString>;
        webFetches: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            url: z.ZodString;
            status: z.ZodEnum<{
                fetching: "fetching";
                done: "done";
                error: "error";
            }>;
            title: z.ZodOptional<z.ZodString>;
            errorCode: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        attachments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            messageId: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            size: z.ZodNumber;
            kind: z.ZodEnum<{
                text: "text";
                pdf: "pdf";
                image: "image";
            }>;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            sent: "sent";
            queued: "queued";
            streaming: "streaming";
            failed: "failed";
        }>;
        error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        truncated: z.ZodBoolean;
        createdAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SseMessageEvent = z.infer<typeof sseMessageEventSchema>;
/** A message was sent while another reply was being written; it waits in the chat's queue. */
export declare const sseQueuedEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"queued">;
    messageId: z.ZodString;
}, z.core.$strip>;
export type SseQueuedEvent = z.infer<typeof sseQueuedEventSchema>;
/** The server picked a message up and created the (still empty) assistant reply `messageId`. */
export declare const sseStartedEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"started">;
    messageId: z.ZodString;
}, z.core.$strip>;
export type SseStartedEvent = z.infer<typeof sseStartedEventSchema>;
/** A piece of the answer text. */
export declare const sseTokenEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"token">;
    messageId: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export type SseTokenEvent = z.infer<typeof sseTokenEventSchema>;
/** A piece of the model's reasoning, streamed before (or between) the answer tokens. */
export declare const sseReasoningEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"reasoning">;
    messageId: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export type SseReasoningEvent = z.infer<typeof sseReasoningEventSchema>;
/** The model started fetching a page, or a fetch finished (same `fetch.id`). */
export declare const sseWebFetchEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"web_fetch">;
    messageId: z.ZodString;
    fetch: z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        status: z.ZodEnum<{
            fetching: "fetching";
            done: "done";
            error: "error";
        }>;
        title: z.ZodOptional<z.ZodString>;
        errorCode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SseWebFetchEvent = z.infer<typeof sseWebFetchEventSchema>;
/** The reply is saved. `stopped`: the user stopped it; `truncated`: the model hit its output token
 * limit and the answer is cut off (AICHAT-212). */
export declare const sseDoneEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"done">;
    messageId: z.ZodString;
    stopped: z.ZodOptional<z.ZodBoolean>;
    truncated: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type SseDoneEvent = z.infer<typeof sseDoneEventSchema>;
/** The provider failed; the reply is saved as `failed` with what was written so far (AICHAT-211).
 * `retryable`: a retry may succeed (rate limit, overload, server error). */
export declare const sseErrorEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"error">;
    messageId: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
}, z.core.$strip>;
export type SseErrorEvent = z.infer<typeof sseErrorEventSchema>;
export declare const sseEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"message">;
    message: z.ZodObject<{
        id: z.ZodString;
        chatId: z.ZodString;
        authorId: z.ZodString;
        authorEmail: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
            system: "system";
        }>;
        content: z.ZodString;
        reasoning: z.ZodNullable<z.ZodString>;
        webFetches: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            url: z.ZodString;
            status: z.ZodEnum<{
                fetching: "fetching";
                done: "done";
                error: "error";
            }>;
            title: z.ZodOptional<z.ZodString>;
            errorCode: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        attachments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            messageId: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            size: z.ZodNumber;
            kind: z.ZodEnum<{
                text: "text";
                pdf: "pdf";
                image: "image";
            }>;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            sent: "sent";
            queued: "queued";
            streaming: "streaming";
            failed: "failed";
        }>;
        error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        truncated: z.ZodBoolean;
        createdAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"queued">;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"started">;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"token">;
    messageId: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"reasoning">;
    messageId: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"web_fetch">;
    messageId: z.ZodString;
    fetch: z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        status: z.ZodEnum<{
            fetching: "fetching";
            done: "done";
            error: "error";
        }>;
        title: z.ZodOptional<z.ZodString>;
        errorCode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"done">;
    messageId: z.ZodString;
    stopped: z.ZodOptional<z.ZodBoolean>;
    truncated: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    messageId: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
}, z.core.$strip>], "type">;
export type SseEvent = z.infer<typeof sseEventSchema>;
export type SseEventType = SseEvent["type"];
/** Every event name, in the order of `sseEventSchema`. */
export declare const SSE_EVENT_TYPES: readonly SseEventType[];
