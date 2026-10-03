import { describe, expect, it } from "vitest";
import {
  MAX_PANES,
  closePane,
  focusedOrientation,
  openInFocusedPane,
  openInNewPane,
  paneIds,
  paneRects,
  setFocusedOrientation,
  visibleLayout,
  type LayoutNode,
} from "./split-panes";

const p = (chatId: string): LayoutNode => ({ kind: "pane", chatId });
const row = (...children: LayoutNode[]): LayoutNode => ({ kind: "group", orientation: "horizontal", children });
const col = (...children: LayoutNode[]): LayoutNode => ({ kind: "group", orientation: "vertical", children });

describe("split panes", () => {
  it("shows the stored layout only while the focused chat is part of it", () => {
    expect(visibleLayout(row(p("a"), p("b")), "b")).toEqual(row(p("a"), p("b")));
    expect(visibleLayout(row(p("a"), p("b")), "c")).toEqual(p("c"));
    expect(visibleLayout(row(p("a"), p("b")), undefined)).toBeNull();
  });

  it("opening a chat swaps it into the focused pane, or just focuses it if already open", () => {
    expect(openInFocusedPane(row(p("a"), col(p("b"), p("c"))), "b", "d")).toEqual(row(p("a"), col(p("d"), p("c"))));
    expect(openInFocusedPane(row(p("a"), p("b")), "b", "a")).toEqual(row(p("a"), p("b")));
    expect(openInFocusedPane(null, undefined, "a")).toEqual(p("a"));
  });

  it("opening in split adds a pane right of or below the focused one, mixing orientations", () => {
    const sideBySide = openInNewPane(p("a"), "a", "b", "horizontal");
    expect(sideBySide).toEqual(row(p("a"), p("b")));
    // Same direction joins the existing group; the other direction splits only the focused pane.
    expect(openInNewPane(sideBySide, "a", "c", "horizontal")).toEqual(row(p("a"), p("c"), p("b")));
    const mixed = openInNewPane(sideBySide, "b", "c", "vertical");
    expect(mixed).toEqual(row(p("a"), col(p("b"), p("c"))));
    expect(openInNewPane(mixed, "c", "d", "horizontal")).toEqual(row(p("a"), col(p("b"), row(p("c"), p("d")))));
    expect(openInNewPane(mixed, "a", "a", "vertical")).toEqual(mixed);
  });

  it("caps the layout at MAX_PANES, beyond which the chat replaces the focused pane", () => {
    const full = row(col(p("a"), p("b")), col(p("c"), p("d")));
    expect(paneIds(full)).toHaveLength(MAX_PANES);
    expect(openInNewPane(full, "c", "z", "vertical")).toEqual(row(col(p("a"), p("b")), col(p("z"), p("d"))));
  });

  it("closing a pane collapses its group and moves focus only when the focused pane closes", () => {
    const layout = row(p("a"), col(p("b"), p("c")));
    expect(closePane(layout, "b", "b")).toEqual({ root: row(p("a"), p("c")), focus: "a" });
    expect(closePane(layout, "a", "a")).toEqual({ root: col(p("b"), p("c")), focus: "b" });
    expect(closePane(layout, "a", "c")).toEqual({ root: row(p("a"), p("b")), focus: "a" });
    expect(closePane(p("a"), "a", "a")).toEqual({ root: null, focus: undefined });
  });

  it("flips only the focused pane's group, merging it into a parent of the same orientation", () => {
    const layout = row(p("a"), col(p("b"), p("c")));
    expect(focusedOrientation(layout, "b")).toBe("vertical");
    expect(focusedOrientation(layout, "a")).toBe("horizontal");
    expect(focusedOrientation(p("a"), "a")).toBeUndefined();
    expect(setFocusedOrientation(layout, "a", "vertical")).toEqual(col(p("a"), p("b"), p("c")));
    expect(setFocusedOrientation(layout, "b", "horizontal")).toEqual(row(p("a"), p("b"), p("c")));
  });

  it("gives each pane an equal share of its group's space", () => {
    expect(paneRects(row(p("a"), col(p("b"), p("c"))))).toEqual([
      { chatId: "a", top: 0, left: 0, width: 50, height: 100 },
      { chatId: "b", top: 0, left: 50, width: 50, height: 50 },
      { chatId: "c", top: 50, left: 50, width: 50, height: 50 },
    ]);
  });
});
