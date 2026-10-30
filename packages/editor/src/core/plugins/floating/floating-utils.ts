import { useEffect, useState } from "react";

import { getDOMSelectionRangeAndPoints, type LexicalEditor } from "lexical";

const TABLE_SCROLL_WRAPPER = ".lexical-table-scrollable-wrapper";
const VISIBLE_EDGE = 24;

export function getDOMRangeRect(
  nativeSelection: Selection,
  rootElement: HTMLElement,
): DOMRect {
  const { points, range } = getDOMSelectionRangeAndPoints(
    nativeSelection,
    rootElement,
  );
  if (points.anchorNode === rootElement || range === null) {
    let inner = rootElement;
    while (inner.firstElementChild != null) {
      inner = inner.firstElementChild as HTMLElement;
    }
    return inner.getBoundingClientRect();
  }
  return range.getBoundingClientRect();
}

export function setFloatingAnchorRect(
  floatingAnchor: HTMLElement,
  targetRect: DOMRect,
): void {
  // The anchor is `position: fixed` at 0,0, which is the viewport's corner
  // unless an ancestor's transform or translate makes that ancestor its
  // containing block (a centred dialog does). Measure where 0,0 lands and
  // place the anchor relative to it.
  floatingAnchor.style.transform = "translate(0px, 0px)";
  const origin = floatingAnchor.getBoundingClientRect();
  floatingAnchor.style.transform = `translate(${targetRect.left - origin.left}px, ${targetRect.top - origin.top}px)`;
  floatingAnchor.style.width = `${targetRect.width}px`;
  floatingAnchor.style.height = `${targetRect.height}px`;
}

export function hideFloatingAnchor(floatingAnchor: HTMLElement): void {
  floatingAnchor.style.transform = "translate(-10000px, -10000px)";
}

export function getTableClipRect(table: HTMLElement): DOMRect {
  const wrapper = table.closest(TABLE_SCROLL_WRAPPER);
  return (wrapper ?? table).getBoundingClientRect();
}

export function isRectVisibleInClip(
  rect: DOMRect,
  clip: DOMRect,
  minVisible = VISIBLE_EDGE,
): boolean {
  const left = Math.max(rect.left, clip.left);
  const right = Math.min(rect.right, clip.right);
  const top = Math.max(rect.top, clip.top);
  const bottom = Math.min(rect.bottom, clip.bottom);
  return right - left >= minVisible && bottom - top >= minVisible;
}

/**
 * The part of the screen where the editor's content can be seen: the
 * viewport, narrowed to the nearest scroll container that actually scrolls,
 * and to below the document's sticky header (title row and version bar).
 */
/**
 * The element that actually scrolls the editor's content: the nearest
 * ancestor with auto or scroll overflow and content taller than itself, else
 * the page. (An `overflow-y-auto` column that grows with its content does
 * not scroll; the page around it does.)
 */
export function getEditorScroller(rootElement: HTMLElement): HTMLElement | null {
  for (let element = rootElement.parentElement; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight
    ) {
      return element;
    }
  }
  return null;
}

export function getEditorVisibleArea(rootElement: HTMLElement): {
  top: number;
  bottom: number;
} {
  let top = 0;
  let bottom = window.innerHeight;
  const scroller = getEditorScroller(rootElement);
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    top = Math.max(top, rect.top);
    bottom = Math.min(bottom, rect.bottom);
  }
  const topBar = rootElement
    .closest("[data-document-root]")
    ?.querySelector("[data-document-topbar]");
  if (topBar) {
    top = Math.max(top, topBar.getBoundingClientRect().bottom);
  }
  return { top, bottom };
}

/** Space kept between a revealed element and the top of the editor's visible area. */
const REVEAL_OFFSET = 96;

/**
 * Scrolls so `target` sits a fixed distance below the top of the editor's
 * visible area (under the sticky header), wherever it was before, and
 * whether the editor column or the page scrolls.
 */
export function revealInEditor(rootElement: HTMLElement, target: HTMLElement) {
  const area = getEditorVisibleArea(rootElement);
  const offset = Math.min(REVEAL_OFFSET, (area.bottom - area.top) / 4);
  const delta = target.getBoundingClientRect().top - (area.top + offset);
  if (Math.abs(delta) < 4) {
    return;
  }
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  const scroller = getEditorScroller(rootElement);
  if (scroller) {
    scroller.scrollBy({ top: delta, behavior });
  } else {
    window.scrollBy({ top: delta, behavior });
  }
}

export function useFloatingCollisionBoundary(editor: LexicalEditor) {
  const [boundary, setBoundary] = useState<HTMLElement | null>(null);

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      setBoundary(rootElement?.parentElement ?? rootElement);
    });
  }, [editor]);

  return boundary;
}
