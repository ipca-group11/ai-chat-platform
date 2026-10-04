/**
 * Server-Sent Event shapes streamed from `GET /chats/:id/stream` (ARCHITECTURE.md §5).
 * Discriminated on `type` so clients can narrow with a switch. Defined in `../stream-events`
 * (a self-contained module the backend loads as compiled JS) and re-exported here.
 */
export {
  attachmentDtoSchema,
  messageDtoSchema,
  sseMessageEventSchema,
  sseQueuedEventSchema,
  sseStartedEventSchema,
  sseTokenEventSchema,
  sseReasoningEventSchema,
  sseWebFetchEventSchema,
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseEventSchema,
  SSE_EVENT_TYPES,
} from "../stream-events";
export type {
  AttachmentDto,
  MessageDto,
  SseMessageEvent,
  SseQueuedEvent,
  SseStartedEvent,
  SseTokenEvent,
  SseReasoningEvent,
  SseWebFetchEvent,
  SseDoneEvent,
  SseErrorEvent,
  SseEvent,
  SseEventType,
} from "../stream-events";
