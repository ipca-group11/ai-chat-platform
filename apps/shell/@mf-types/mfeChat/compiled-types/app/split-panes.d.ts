/** `horizontal` = panes side by side; `vertical` = panes stacked top to bottom. */
export type SplitOrientation = "horizontal" | "vertical";
/**
 * The split layout is a tree: leaves are chat panes, and each group lays its children out
 * side by side or stacked. Nesting groups mixes both, e.g. two chats side by side with a
 * third below them. Groups always have 2+ children, and a group never directly contains a
 * group of the same orientation (see `normalize`).
 */
export type LayoutNode = {
    kind: "pane";
    chatId: string;
} | {
    kind: "group";
    orientation: SplitOrientation;
    children: LayoutNode[];
};
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
export declare const MAX_PANES = 4;
/** Chat ids of every pane, in reading order. */
export declare function paneIds(node: LayoutNode | null): string[];
/**
 * The layout actually shown for the chat in the URL (the focused pane). A focused chat
 * that is not part of the stored layout (e.g. reached via a link or the back button)
 * collapses the workspace to that single chat.
 */
export declare function visibleLayout(root: LayoutNode | null, focusedId: string | undefined): LayoutNode | null;
/** Opening a chat normally swaps it into the focused pane (or focuses it if already open). */
export declare function openInFocusedPane(root: LayoutNode | null, focusedId: string | undefined, chatId: string): LayoutNode | null;
/**
 * Opening a chat "in split" puts a new pane right of (`horizontal`) or below (`vertical`)
 * the focused one, splitting only the focused pane's space. Capped at MAX_PANES, beyond
 * which the chat replaces the focused pane instead.
 */
export declare function openInNewPane(root: LayoutNode | null, focusedId: string | undefined, chatId: string, orientation: SplitOrientation): LayoutNode | null;
/** Removes a pane; returns the remaining layout and the chat that should be focused next. */
export declare function closePane(root: LayoutNode | null, focusedId: string | undefined, chatId: string): {
    root: LayoutNode | null;
    focus: string | undefined;
};
/** Orientation of the group holding the focused pane (undefined when it stands alone). */
export declare function focusedOrientation(root: LayoutNode | null, focusedId: string | undefined): SplitOrientation | undefined;
/** Flips the group holding the focused pane between side by side and stacked. */
export declare function setFocusedOrientation(root: LayoutNode | null, focusedId: string | undefined, orientation: SplitOrientation): LayoutNode | null;
/** Where each pane sits; children of a group share its space equally. */
export declare function paneRects(node: LayoutNode | null, top?: number, left?: number, width?: number, height?: number): PaneRect[];
/** Split-view layout state, remembered per browser so a reload restores the open panes. */
export declare function useSplitLayout(): readonly [SplitLayout, (update: (prev: SplitLayout) => SplitLayout) => void];
