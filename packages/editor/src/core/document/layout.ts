/**
 * Layout classes shared by the document editor and its loading state, so the
 * placeholder sits exactly where the content appears.
 */
export const DOCUMENT_LAYOUT = {
  root: "flex h-full min-h-0 min-w-0 flex-col",
  headerRow:
    "sticky top-0 z-20 flex min-h-12 shrink-0 items-center gap-2 bg-background px-4 py-2",
  headerStart: "flex min-w-0 flex-1 items-center gap-2",
  headerEnd: "flex shrink-0 items-center gap-2",
  /**
   * Centered reading column for `page` documents. The side padding keeps the
   * block handles (in the content inset) clear of a narrow container's edge.
   */
  pageColumn: "mx-auto max-w-4xl px-6 pt-4 pb-32 sm:px-12",
  /**
   * Room for the block handles in a non-page editor: they sit left of the
   * content inset, and the scroll container would clip them.
   */
  handleSpace: "ps-6",
  /** Keeps the first line of a non-page editor clear of the corner actions. */
  cornerActionsSpace: "pt-8",
  /**
   * Comments and versions panels: a framed panel beside the document, inset
   * by 0.5rem, that sticks under the header and fills the visible height
   * (variables set by `useStickyPanelStyle`), whether the editor or the page
   * scrolls. It slides in when opened.
   */
  sidePanel:
    "sticky top-[calc(var(--document-header-height,0px)+0.5rem)] my-2 me-2 flex h-[calc(var(--document-panel-height,100%)-1rem)] w-80 shrink-0 flex-col self-start overflow-hidden rounded-xl border bg-background animate-in fade-in-0 slide-in-from-right-4 duration-200 motion-reduce:animate-none",
  /** The writing surface's inset (the draggable ContentEditable variant). */
  contentInset: "px-12 py-4",
} as const;
