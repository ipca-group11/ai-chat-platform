import type { ResponseConfig, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { expect } from "vitest";
import type { z } from "zod";
import { routeConfigs } from "../openapi/document.js";
import { CORRELATION_HEADER, errorResponseSchema } from "../shared/contracts/http.js";

/** What a response looks like to the checker: supertest's `Response`, or a hand-made one for the stream. */
export interface CheckedResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  text?: string;
}

/** The route table of the spec, keyed Express style: `GET /chats/:id`. */
export const SPEC_ROUTES: ReadonlyMap<string, RouteConfig> = new Map(
  routeConfigs().map((config) => [`${config.method.toUpperCase()} ${config.path.replace(/\{(\w+)\}/g, ":$1")}`, config]),
);

function header(res: CheckedResponse, name: string): string | undefined {
  const value = res.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * AICHAT-185: checks one real response against what the spec says about `route`.
 *
 * - The status must be documented for the route (an undocumented 500 or 400 fails).
 * - A JSON body must parse with the documented Zod schema, and parsing must not change it. `z.object`
 *   drops unknown keys at every depth, so `parse(body)` equals `body` only when the body has no field
 *   the schema does not know about: a strict check of the whole tree.
 * - Every error body is the shared envelope, and its `correlationId` is the `X-Correlation-Id` header.
 *
 * Records `route status` in `seen`, so a suite can prove that every route was checked.
 */
export function createResponseChecker() {
  const seen = new Set<string>();

  function expectDocumentedResponse(route: string, res: CheckedResponse): void {
    const config = SPEC_ROUTES.get(route);
    expect(config, `${route} is not in the OpenAPI spec`).toBeDefined();
    const documented = (config?.responses as Record<string, ResponseConfig | undefined>)[String(res.status)];
    expect(documented, `${route} answered ${res.status}, which the spec does not document: ${JSON.stringify(res.body ?? res.text)}`).toBeDefined();
    if (!documented) return;

    const contentType = header(res, "content-type") ?? "";
    const media = Object.keys(documented.content ?? {});
    if (media.length === 0) {
      expect(res.text ?? "", `${route} ${res.status} must have no body`).toBe("");
    } else {
      expect(media.some((type) => contentType.startsWith(type)), `${route} ${res.status} content type ${contentType}`).toBe(true);
    }

    const jsonMedia = documented.content?.["application/json"];
    const jsonSchema = jsonMedia && "schema" in jsonMedia ? (jsonMedia.schema as z.ZodType) : undefined;
    if (jsonSchema) {
      const parsed = jsonSchema.safeParse(res.body);
      expect(parsed.success, `${route} ${res.status} body does not match its schema: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(parsed.data, `${route} ${res.status} body has fields the schema does not describe`).toEqual(res.body);
    }

    expect(header(res, CORRELATION_HEADER), `${route} ${res.status} has no ${CORRELATION_HEADER} header`).toBeTruthy();
    if (res.status >= 400) {
      expect(jsonSchema, `${route} ${res.status} is not documented with the error envelope`).toBe(errorResponseSchema);
      expect((res.body as { correlationId?: string }).correlationId).toBe(header(res, CORRELATION_HEADER));
    }
    seen.add(`${route} ${res.status}`);
  }

  /** The documented success status of each route that no test has checked yet. */
  function uncheckedSuccesses(): string[] {
    return [...SPEC_ROUTES.entries()].flatMap(([route, config]) =>
      Object.keys(config.responses)
        .filter((status) => Number(status) < 400 && !seen.has(`${route} ${status}`))
        .map((status) => `${route} ${status}`),
    );
  }

  return { expectDocumentedResponse, uncheckedSuccesses, seen };
}
