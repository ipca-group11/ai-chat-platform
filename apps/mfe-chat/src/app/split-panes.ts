import { useCallback, useState } from "react";

/** `horizontal` = panes side by side; `vertical` = panes stacked top to bottom. */
export type SplitOrientation = "horizontal" | "vertical";

/**
 * The split layout is a tree: leaves are chat panes, and each group lays its children out
 * side by side or stacked. Nesting groups mixes both, e.g. two chats side by side with a
 * third below them. Groups always have 2+ children, and a group never directly contains a
 * group of the same orientation (see `normalize`).
 */
export type LayoutNode =
  | { kind: "pane"; chatId: string }
  | { kind: "group"; orientation: SplitOrientation; children: LayoutNode[] };

export interface SplitLayout {
  root: LayoutNode | null;
}

/** A pane's position within the workspace, in percentages of its width and height. */
export interface PaneRect {
  chatId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export const MAX_PANES = 4;

const STORAGE_KEY = "mfe-chat:split-layout";
const EMPTY_LAYOUT: SplitLayout = { root: null };

const pane = (chatId: string): LayoutNode => ({ kind: "pane", chatId });

/** Chat ids of every pane, in reading order. */
export function paneIds(node: LayoutNode | null): string[] {
  if (!node) return [];
  return node.kind === "pane" ? [node.chatId] : node.children.flatMap(paneIds);
}

/** Drops empty groups, unwraps single-child groups, and merges same-orientation nested groups. */
function normalize(node: LayoutNode | null): LayoutNode | null {
  if (!node || node.kind === "pane") return node;
  const children = node.children
    .map(normalize)
    .filter((child): child is LayoutNode => child !== null)
    .flatMap((child) =>
      child.kind === "group" && child.orientation === node.orientation ? child.children : [child]
    );
  if (children.length === 0) return null;
  if (children.length === 1) return children[0] ?? null;
  return { ...node, children };
}

function mapPane(node: LayoutNode, chatId: string, replace: (leaf: LayoutNode) => LayoutNode): LayoutNode {
  if (node.kind === "pane") return node.chatId === chatId ? replace(node) : node;
  return { ...node, children: node.children.map((child) => mapPane(child, chatId, replace)) };
}

/** The group directly containing a pane, if any. */
function parentGroup(node: LayoutNode | null, chatId: string): Extract<LayoutNode, { kind: "group" }> | undefined {
  if (!node || node.kind === "pane") return undefined;
  if (node.children.some((child) => child.kind === "pane" && child.chatId === chatId)) return node;
  for (const child of node.children) {
    const found = parentGroup(child, chatId);
    if (found) return found;
  }
  return undefined;
}

/**
 * The layout actually shown for the chat in the URL (the focused pane). A focused chat
 * that is not part of the stored layout (e.g. reached via a link or the back button)
 * collapses the workspace to that single chat.
 */
export function visibleLayout(root: LayoutNode | null, focusedId: string | undefined): LayoutNode | null {
  if (!focusedId) return null;
  return paneIds(root).includes(focusedId) ? root : pane(focusedId);
}

/** Opening a chat normally swaps it into the focused pane (or focuses it if already open). */
export function openInFocusedPane(
  root: LayoutNode | null,
  focusedId: string | undefined,
  chatId: string
): LayoutNode | null {
  const current = visibleLayout(root, focusedId);
  if (!current || !focusedId) return pane(chatId);
  if (paneIds(current).includes(chatId)) return current;
  return mapPane(current, focusedId, () => pane(chatId));
}

/**
 * Opening a chat "in split" puts a new pane right of (`horizontal`) or below (`vertical`)
 * the focused one, splitting only the focused pane's space. Capped at MAX_PANES, beyond
 * which the chat replaces the focused pane instead.
 */
export function openInNewPane(
  root: LayoutNode | null,
  focusedId: string | undefined,
  chatId: string,
  orientation: SplitOrientation
): LayoutNode | null {
  const current = visibleLayout(root, focusedId);
  if (!current || !focusedId) return pane(chatId);
  const ids = paneIds(current);
  if (ids.includes(chatId)) return current;
  if (ids.length >= MAX_PANES) return openInFocusedPane(root, focusedId, chatId);

  const insert = (node: LayoutNode): LayoutNode => {
    if (node.kind === "pane") {
      return node.chatId === focusedId ? { kind: "group", orientation, children: [node, pane(chatId)] } : node;
    }
    const at = node.children.findIndex((child) => child.kind === "pane" && child.chatId === focusedId);
    if (at >= 0 && node.orientation === orientation) {
      return { ...node, children: [...node.children.slice(0, at + 1), pane(chatId), ...node.children.slice(at + 1)] };
    }
    return { ...node, children: node.children.map(insert) };
  };
  return normalize(insert(current));
}

/** Removes a pane; returns the remaining layout and the chat that should be focused next. */
export function closePane(
  root: LayoutNode | null,
  focusedId: string | undefined,
  chatId: string
): { root: LayoutNode | null; focus: string | undefined } {
  const current = visibleLayout(root, focusedId);
  const ids = paneIds(current);
  const index = ids.indexOf(chatId);
  const remove = (node: LayoutNode): LayoutNode | null => {
    if (node.kind === "pane") return node.chatId === chatId ? null : node;
    return {
      ...node,
      children: node.children.map(remove).filter((child): child is LayoutNode => child !== null),
    };
  };
  const next = current ? normalize(remove(current)) : null;
  if (chatId !== focusedId) return { root: next, focus: focusedId };
  const remaining = paneIds(next);
  return { root: next, focus: remaining[Math.max(0, index - 1)] };
}

/** Orientation of the group holding the focused pane (undefined when it stands alone). */
export function focusedOrientation(root: LayoutNode | null, focusedId: string | undefined): SplitOrientation | undefined {
  return focusedId ? parentGroup(root, focusedId)?.orientation : undefined;
}

/** Flips the group holding the focused pane between side by side and stacked. */
export function setFocusedOrientation(
  root: LayoutNode | null,
  focusedId: string | undefined,
  orientation: SplitOrientation
): LayoutNode | null {
  const group = focusedId ? parentGroup(root, focusedId) : undefined;
  if (!root || !group) return root;
  const flip = (node: LayoutNode): LayoutNode => {
    if (node.kind === "pane") return node;
    const children = node.children.map(flip);
    return node === group ? { ...node, orientation, children } : { ...node, children };
  };
  return normalize(flip(root));
}

/** Where each pane sits; children of a group share its space equally. */
export function paneRects(node: LayoutNode | null, top = 0, left = 0, width = 100, height = 100): PaneRect[] {
  if (!node) return [];
  if (node.kind === "pane") return [{ chatId: node.chatId, top, left, width, height }];
  const count = node.children.length;
  return node.children.flatMap((child, i) =>
    node.orientation === "horizontal"
      ? paneRects(child, top, left + (width * i) / count, width / count, height)
      : paneRects(child, top + (height * i) / count, left, width, height / count)
  );
}

function parseNode(value: unknown): LayoutNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  if (node.kind === "pane") return typeof node.chatId === "string" ? pane(node.chatId) : null;
  if (node.kind === "group" && Array.isArray(node.children)) {
    const orientation = node.orientation === "vertical" ? "vertical" : "horizontal";
    const children = node.children.map(parseNode).filter((child): child is LayoutNode => child !== null);
    return { kind: "group", orientation, children };
  }
  return null;
}

function readLayout(): SplitLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as { root?: unknown; panes?: unknown; orientation?: unknown };
    // Earlier versions stored a flat list of panes with one orientation for all of them.
    const root = Array.isArray(parsed.panes)
      ? parseNode({ kind: "group", orientation: parsed.orientation, children: parsed.panes.map((id) => ({ kind: "pane", chatId: id })) })
      : parseNode(parsed.root);
    const normalized = normalize(root);
    const ids = paneIds(normalized);
    if (ids.length > MAX_PANES || new Set(ids).size !== ids.length) return EMPTY_LAYOUT;
    return { root: normalized };
  } catch {
    return EMPTY_LAYOUT;
  }
}

function writeLayout(layout: SplitLayout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable (private mode, blocked): the layout just won't survive a reload.
  }
}

/** Split-view layout state, remembered per browser so a reload restores the open panes. */
export function useSplitLayout() {
  const [layout, setLayoutState] = useState<SplitLayout>(readLayout);

  const setLayout = useCallback((update: (prev: SplitLayout) => SplitLayout) => {
    setLayoutState((prev) => {
      const next = update(prev);
      writeLayout(next);
      return next;
    });
  }, []);

  return [layout, setLayout] as const;
}
