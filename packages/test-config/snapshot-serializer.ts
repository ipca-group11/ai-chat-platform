import { fileURLToPath } from "node:url";
import type { SnapshotSerializer } from "vitest";

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g;

/** Replaces every UUID with `<uuid>` and every ISO 8601 date-time with `<date>`. */
export function normalizeSnapshotText(text: string): string {
  return text.replace(UUID_PATTERN, "<uuid>").replace(ISO_DATE_PATTERN, "<date>");
}

/**
 * Vitest snapshot serializer for DTOs and wire output (docs/AICHAT-20, decision on
 * snapshot targets). Ids and timestamps change on every run, so they are replaced before
 * the snapshot is written or compared. It works on every string it meets, inside objects,
 * arrays or on its own (an SSE frame, for example). Everything else is left to the
 * default serializers.
 */
export const snapshotSerializer: SnapshotSerializer = {
  test: (value: unknown) =>
    typeof value === "string" && normalizeSnapshotText(value) !== value,
  serialize: (value, config, indentation, depth, refs, printer) =>
    printer(normalizeSnapshotText(value as string), config, indentation, depth, refs),
};

export default snapshotSerializer;

/**
 * Absolute path of this module, for the `test.snapshotSerializers` option of a project's
 * `vitest.config.ts`: `snapshotSerializers: [snapshotSerializerPath]`.
 */
export const snapshotSerializerPath: string = fileURLToPath(import.meta.url);
