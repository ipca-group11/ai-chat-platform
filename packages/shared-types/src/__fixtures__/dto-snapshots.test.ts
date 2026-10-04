import { describe, expect, it } from "vitest";
import { fixtures } from "./index";
import { toErrorResponse } from "../http/error-response";

// Snapshots pin the serialised shape of every DTO in docs/AICHAT-20/README.md section 4.2.
// Ids and dates are normalised by the serializer from @platform/test-config.
// Small outputs are inline; the combined SSE list is a file snapshot (__snapshots__).
// Review rule: a changed snapshot needs a reason in the pull request. Update with
// `vitest -u` on your machine, never in CI.

describe("DTO snapshots", () => {
  it("userProfile", () => {
    expect(fixtures.userProfile.schema.parse(fixtures.userProfile.input)).toMatchInlineSnapshot(`
      {
        "createdAt": "<date>",
        "email": "ana@example.com",
        "id": "<uuid>",
      }
    `);
  });

  it("authResponse", () => {
    expect(fixtures.authResponse.schema.parse(fixtures.authResponse.input)).toMatchInlineSnapshot(`
      {
        "user": {
          "createdAt": "<date>",
          "email": "ana@example.com",
          "id": "<uuid>",
        },
      }
    `);
  });

  it("accessTokenClaims", () => {
    expect(
      fixtures.accessTokenClaims.schema.parse(fixtures.accessTokenClaims.input),
    ).toMatchInlineSnapshot(`
      {
        "email": "ana@example.com",
        "exp": 1790000900,
        "iat": 1790000000,
        "sub": "<uuid>",
      }
    `);
  });

  it("chat", () => {
    expect(fixtures.chat.schema.parse(fixtures.chat.input)).toMatchInlineSnapshot(`
      {
        "createdAt": "<date>",
        "id": "<uuid>",
        "model": "claude-haiku-4-5",
        "ownerId": "<uuid>",
        "provider": "anthropic",
        "reasoning": false,
        "title": "Weekly planning",
        "updatedAt": "<date>",
        "webFetch": true,
      }
    `);
  });

  it("chatMember", () => {
    expect(fixtures.chatMember.schema.parse(fixtures.chatMember.input)).toMatchInlineSnapshot(`
      {
        "addedAt": "<date>",
        "email": "ana@example.com",
        "role": "owner",
      }
    `);
  });

  it("message, with web fetches and the default attachment list", () => {
    expect(fixtures.message.schema.parse(fixtures.message.input)).toMatchInlineSnapshot(`
      {
        "attachmentIds": [
          "<uuid>",
        ],
        "chatId": "<uuid>",
        "content": "Here is the summary you asked for.",
        "createdAt": "<date>",
        "id": "<uuid>",
        "reasoning": "The user wants a short summary.",
        "role": "assistant",
        "status": "complete",
        "webFetches": [
          {
            "id": "<uuid>",
            "status": "done",
            "title": "Example article",
            "url": "https://example.com/article",
          },
        ],
      }
    `);
    const { attachmentIds: _omitted, ...withoutAttachments } = fixtures.message.input;
    expect(fixtures.message.schema.parse(withoutAttachments).attachmentIds).toMatchInlineSnapshot(`[]`);
  });

  it("attachment", () => {
    expect(fixtures.attachment.schema.parse(fixtures.attachment.input)).toMatchInlineSnapshot(`
      {
        "createdAt": "<date>",
        "extractedTextStatus": "extracted",
        "id": "<uuid>",
        "messageId": "<uuid>",
        "mimeType": "application/pdf",
        "originalFilename": "notes.pdf",
        "ownerId": "<uuid>",
        "size": 20480,
        "storedPath": "uploads/ana/notes.pdf",
      }
    `);
  });

  it("testConnectionResponse", () => {
    expect(
      fixtures.testConnectionResponse.schema.parse(fixtures.testConnectionResponse.input),
    ).toMatchInlineSnapshot(`
      {
        "message": "The provider rejected the API key",
        "success": false,
      }
    `);
  });

  it("every SSE event, in the order of sseEventSchema", () => {
    const events = [
      fixtures.sseToken,
      fixtures.sseReasoning,
      fixtures.sseWebFetch,
      fixtures.sseDone,
      fixtures.sseError,
      fixtures.sseQueued,
    ].map(({ schema, input }) => schema.parse(input));
    expect(events).toMatchSnapshot();
  });
});

describe("toErrorResponse snapshots", () => {
  it("minimal error", () => {
    expect(toErrorResponse("NOT_FOUND", "Resource not found")).toMatchInlineSnapshot(`
      {
        "error": {
          "code": "NOT_FOUND",
          "message": "Resource not found",
        },
      }
    `);
  });

  it("validation error with field errors and a correlation id", () => {
    expect(
      fixtures.errorResponse.schema.parse(fixtures.errorResponse.input),
    ).toMatchInlineSnapshot(`
      {
        "correlationId": "<uuid>",
        "error": {
          "code": "VALIDATION_ERROR",
          "fieldErrors": {
            "email": [
              "Invalid email address",
            ],
          },
          "message": "Request validation failed",
        },
      }
    `);
  });
});
