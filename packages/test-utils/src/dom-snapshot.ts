import { normalizeSnapshotText } from "@platform/test-config/snapshot-serializer";

// React `useId` values in their 19.2 (`_r_1f_`), 19.0-19.1 (`«r1f»`) and 18 (`:r1f:`) forms.
const REACT_ID = /_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g;

/**
 * A copy of `node` that is stable to snapshot (docs/AICHAT-20, component snapshots). React
 * numbers `useId` values with one counter for the whole test file, so a story added before
 * another would change every id after it: ids are renumbered here in order of appearance,
 * per snapshot. UUIDs and ISO date-times in attributes and text become `<uuid>` and `<date>`,
 * as the string serializer does for DTOs.
 */
export function stableDom<T extends Node>(node: T): T {
  const copy = node.cloneNode(true) as T;
  const ids = new Map<string, string>();
  const normalize = (text: string) =>
    normalizeSnapshotText(
      text.replace(REACT_ID, (id) => {
        if (!ids.has(id)) ids.set(id, `_r_${ids.size}_`);
        return ids.get(id) as string;
      }),
    );

  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let current: Node | null = walker.currentNode; current; current = walker.nextNode()) {
    if (current.nodeType === Node.TEXT_NODE) {
      current.nodeValue = normalize(current.nodeValue ?? "");
    } else if (current instanceof Element) {
      for (const attribute of Array.from(current.attributes)) attribute.value = normalize(attribute.value);
    }
  }
  return copy;
}

/**
 * Resolves once `root` has stopped changing for `quietMs`, or after `timeoutMs`. A story's
 * `play` ends when its own steps do, but a rejected query or a resolved stub still re-renders a
 * few ticks later; waiting for a quiet DOM puts the final state in the snapshot. Uses
 * `performance.now()`, as the snapshot runners fake `Date`.
 */
export async function waitForStableDom(root: Element, { quietMs = 50, timeoutMs = 3000 } = {}): Promise<void> {
  const start = performance.now();
  let last = root.innerHTML;
  let quietSince = performance.now();
  while (performance.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const now = root.innerHTML;
    if (now !== last) {
      last = now;
      quietSince = performance.now();
    } else if (performance.now() - quietSince >= quietMs) {
      return;
    }
  }
}
