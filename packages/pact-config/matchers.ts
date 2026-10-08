import { MatchersV3 } from "@pact-foundation/pact";

/**
 * Re-exported Pact matchers (O5, AC-95) so every consumer test imports them from this
 * package instead of reaching into `@pact-foundation/pact` directly — keeps the matcher
 * API surface every pod uses in one documented place.
 */
export const { like, eachLike, boolean } = MatchersV3;

/**
 * V2-style `term(matcher, example)` naming kept for readability at call sites (a regex the
 * value must match, plus a representative example value used to generate the mock); maps
 * onto Pact V3's `regex` matcher.
 */
export const term = MatchersV3.regex;

/**
 * Local mirror of `packages/shared-types`'s `CORRELATION_HEADER` (`STACK.md` decision #8;
 * see `packages/observability/src/logging/correlation-header.ts` for the same pattern and
 * rationale — kept in sync manually until both packages depend on `@shared-types`
 * directly at integration).
 */
export const CORRELATION_HEADER = "X-Correlation-Id";

/** A UUID-shaped matcher for the correlation ID header, for use in interaction headers. */
export function correlationHeaderMatcher() {
  return term("[0-9a-f-]{36}", "11111111-1111-4111-8111-111111111111");
}

/**
 * Shared envelope matcher for the uniform error body every non-2xx response returns
 * (mirrors `packages/shared-types`'s `errorResponseSchema`: `{ error: { code, message,
 * fieldErrors? }, correlationId? }`). Consumer tests use this instead of hand-rolling the
 * shape per interaction, so a shape drift is caught by a single provider-verification
 * failure rather than N slightly-different mocks.
 */
export function errorResponseMatcher(options: { code?: string } = {}) {
  return {
    error: {
      code: options.code ? like(options.code) : like("BAD_REQUEST"),
      message: like("A human-readable error message."),
    },
  };
}

/** Matcher for the error envelope's optional `fieldErrors` map (400s from Zod validation). */
export function fieldErrorsMatcher(exampleField = "email") {
  return {
    error: {
      code: like("VALIDATION_ERROR"),
      message: like("Validation failed."),
      fieldErrors: {
        [exampleField]: eachLike("must be a valid value"),
      },
    },
  };
}
