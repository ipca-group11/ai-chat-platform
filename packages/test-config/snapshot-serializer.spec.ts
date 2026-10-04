import { describe, expect, it } from "vitest";
import snapshotSerializer, { normalizeSnapshotText } from "./snapshot-serializer.ts";

describe("normalizeSnapshotText", () => {
  it("replaces UUIDs of any case", () => {
    expect(
      normalizeSnapshotText("a 3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b and 3F2B8C1E-9A4D-4E6F-8B7A-1C2D3E4F5A6B"),
    ).toBe("a <uuid> and <uuid>");
  });

  it("replaces ISO dates with and without milliseconds or offset", () => {
    expect(
      normalizeSnapshotText(
        "2026-10-03T09:15:30Z 2026-10-03T09:15:30.123Z 2026-10-03T09:15:30+01:00",
      ),
    ).toBe("<date> <date> <date>");
  });

  it("leaves other text alone", () => {
    expect(normalizeSnapshotText("claude-haiku-4-5 2026-10-03 not-a-uuid")).toBe(
      "claude-haiku-4-5 2026-10-03 not-a-uuid",
    );
  });
});

describe("snapshotSerializer", () => {
  it("only claims strings that contain something to replace", () => {
    expect(snapshotSerializer.test("plain")).toBe(false);
    expect(snapshotSerializer.test(42)).toBe(false);
    expect(snapshotSerializer.test({ id: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b" })).toBe(false);
    expect(snapshotSerializer.test("2026-10-03T09:15:30Z")).toBe(true);
  });

  it("hands the normalised text to the printer", () => {
    const printed: unknown[] = [];
    const printer = (value: unknown): string => {
      printed.push(value);
      return "ok";
    };
    const config = {} as Parameters<typeof snapshotSerializer.serialize>[1];

    const out = snapshotSerializer.serialize(
      "event: done\ndata: 3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b at 2026-10-03T09:15:30.000Z",
      config,
      "",
      0,
      [],
      printer,
    );

    expect(out).toBe("ok");
    expect(printed).toEqual(["event: done\ndata: <uuid> at <date>"]);
  });
});
