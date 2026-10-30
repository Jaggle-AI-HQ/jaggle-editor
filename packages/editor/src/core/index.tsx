"use client";

import { lazy, Suspense, useState } from "react";

import { cn } from "../lib/utils";

import { HtmlView } from "./components/html-view";
import { DocumentLoading } from "./document/document-loading";
import type { LexicalEditorProps } from "./lib/types";
import { useIsClient } from "./lib/use-is-client";

// Loaded on demand, so the editors' code (and Yjs, emoji data…) stays out of
// the page's first load. The loading state keeps the editor's layout.
const DocumentSurface = lazy(() => import("./document/surface"));
const LazyCommentComposer = lazy(() => import("./comment/composer"));

const composerLoading = (
  <div className="h-36 animate-pulse rounded-xl border border-border bg-muted/40" />
);

/** The comment composer, client-only. */
function CommentComposer(props: LexicalEditorProps) {
  const isClient = useIsClient();
  if (!isClient) return composerLoading;
  return (
    <Suspense fallback={composerLoading}>
      <LazyCommentComposer {...props} />
    </Suspense>
  );
}

export function LexicalEditor(props: LexicalEditorProps) {
  if (props.readOnly) {
    return <HtmlView html={props.html} commentPreview={props.mode === "comment"} />;
  }

  if (props.mode === "comment") {
    return props.deferUntilFocus ? (
      <DeferredCommentComposer {...props} />
    ) : (
      <CommentComposer {...props} />
    );
  }

  return <DocumentEditor {...props} />;
}

/**
 * The "Add a comment..." box. Until it is first focused it is a placeholder in
 * the composer's frame, so the editor and the emoji data load on focus. The
 * composer then mounts and takes focus.
 */
function DeferredCommentComposer(props: LexicalEditorProps) {
  const [active, setActive] = useState(false);
  if (active) {
    return <CommentComposer {...props} autoFocus />;
  }
  const placeholder = props.placeholder || "Add a comment...";
  return (
    <div
      className={cn(
        "m-2 rounded-2xl border border-border bg-background",
        props.containerClassName,
      )}
    >
      <div
        role="textbox"
        tabIndex={0}
        aria-label={placeholder}
        onFocus={() => setActive(true)}
        className="min-h-20 cursor-text px-4 pt-3 leading-6 text-muted-foreground outline-none"
      >
        {placeholder}
      </div>
      <div className="h-12" />
    </div>
  );
}

function DocumentEditor(props: LexicalEditorProps) {
  const isClient = useIsClient();
  const loading = (
    <DocumentLoading
      page={props.page}
      sideMenu={props.sideMenu ?? true}
      header={props.header}
      hasActions={
        props.showComments ||
        props.showVersionHistory ||
        props.showImport ||
        props.showExport
      }
    />
  );
  // The editor is client-only; it mounts once the caller's content is loaded.
  if (!isClient || props.dataLoading) {
    return loading;
  }
  return (
    <Suspense fallback={loading}>
      <DocumentSurface {...props} />
    </Suspense>
  );
}

/**
 * Markdown (AI output) as document HTML, for content saved without opening an
 * editor. The converter loads on first use.
 */
export async function markdownToDocumentHtml(markdown: string): Promise<string> {
  const { documentHtmlFromMarkdown } = await import("./document/headless");
  return documentHtmlFromMarkdown(markdown);
}

export { DocumentExportDialog } from "./components/document-export-dialog";
export { IncompleteDocumentNotice } from "./components/incomplete-document-notice";
export { useDocumentUi } from "./document/ui-context";
export {
  type CommentPayload,
  commentBody,
  mentionDraft,
  toCommentPayload,
} from "./lib/comment-payload";
export type {
  CommentBody,
  CommentSubmitHandler,
  DocumentChangeHandler,
  DocumentHandle,
  DocumentHeader,
  DocumentSaveStatus,
  DocumentSource,
  ImageUploadScope,
  LexicalEditorProps,
  MentionScope,
} from "./lib/types";
