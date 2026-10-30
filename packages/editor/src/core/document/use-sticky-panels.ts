"use client";

import { type CSSProperties, useEffect, useState } from "react";

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return node;
    }
  }
  return null;
}

/**
 * Sizes the side panels (comments, versions) to the visible area below the
 * header, as CSS variables on the editor root. In a bounded parent that is
 * the editor's own height. In a parent that grows with the document, the page
 * scrolls instead, so the panels stick under the header and take the scroll
 * container's height (or the window's).
 */
export function useStickyPanelStyle(
  root: HTMLElement | null,
  header: HTMLElement | null,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!root) {
      return;
    }
    const scroller = scrollParent(root.parentElement);
    const measure = () => {
      const headerHeight = header?.offsetHeight ?? 0;
      const visible = scroller ? scroller.clientHeight : window.innerHeight;
      const height = Math.max(0, Math.min(root.clientHeight, visible) - headerHeight);
      setStyle((current) => {
        const next = {
          "--document-header-height": `${headerHeight}px`,
          "--document-panel-height": `${height}px`,
        } as CSSProperties;
        const same = Object.entries(next).every(
          ([key, value]) => (current as Record<string, unknown>)[key] === value,
        );
        return same ? current : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (scroller) observer.observe(scroller);
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, header]);

  return style;
}
