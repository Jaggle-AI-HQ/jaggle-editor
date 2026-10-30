import type { ReactNode } from "react";

import type { SerializedEditorState } from "lexical";

import type { MentionScope, UploadScope } from "../../adapters/types";

export type { MentionScope };

/** Where the editor's uploads belong (see `UploadScope`). */
export type ImageUploadScope = UploadScope;

/**
 * A document thread comment: Lexical JSON to edit, HTML to display (mention
 * chips get their hover preview through `HtmlView`), and plain text for search
 * and notifications. Matches the thread API's new comment body.
 */
export type CommentBody = {
  format: "lexical";
  state: SerializedEditorState;
  html: string;
  text: string;
};

export type CommentSubmitHandler = (
  editorState: SerializedEditorState,
  html: string,
  plainText: string,
) => void | Promise<void>;

/**
 * Content for the document header row. The caller owns what goes in it (title,
 * rename, status, extra buttons); the editor lays out the row and adds its own
 * actions after `end`. Slot content renders inside the editor, so it can call
 * `useDocumentUi()`.
 */
export type DocumentHeader = {
  start?: ReactNode;
  end?: ReactNode;
  /** After the editor's own actions (comments, versions, ⋯), e.g. a sheet's close button. */
  trailing?: ReactNode;
};

export type DocumentChangeHandler = (content: {
  /** The HTML a read-only view renders (`readOnly` + `html`). */
  html: string;
  editorState: SerializedEditorState;
}) => void;

/**
 * A saved document: where its content, versions and comment threads live, and
 * its live collaboration room. With a source the editor loads, saves and
 * collaborates by itself.
 */
export type DocumentSource = {
  entityType: string;
  entityId: string;
  /** Defaults to "main". */
  documentKey?: string;
  /**
   * The surface's room name, as the old editor named it (for example
   * `${workspaceId}:workspace_report-${reportId}`). The Lexical room adds
   * ":lexical", so it never shares a Y.Doc with the old editor.
   */
  roomId: string;
  /**
   * HTML to start from while the document has no saved state, for content
   * written outside the editor (a task created with a description). Saved
   * content always wins.
   */
  initialHtml?: string;
};

export type DocumentSaveStatus = "idle" | "saving" | "saved" | "error";

/** Imperative access for the page, from `onReady`. */
export type DocumentHandle = {
  /** Replaces the whole document (AI generation streams through this). */
  replaceWithMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  getHtml: () => string;
  /** The current content, to put back with `restore` (for example after a cancelled generation). */
  snapshot: () => SerializedEditorState;
  restore: (state: SerializedEditorState) => void;
  /** Saves pending changes now. */
  flush: () => Promise<void>;
};

export type LexicalEditorProps = {
  mode: "comment" | "document";
  readOnly?: boolean;
  /**
   * Read only: the HTML shown. Document mode without a `source`: the starting
   * content when there is no `initialEditorState`, read once.
   */
  html?: string;
  placeholder?: string;
  workspaceId?: string;
  page?: boolean;
  sideMenu?: boolean;
  showComments?: boolean;
  showVersionHistory?: boolean;
  showImport?: boolean;
  showExport?: boolean;
  /**
   * Document mode: the caller's content is still fetching. Shows the loading
   * state (with the header) and mounts the editor once it is false, so
   * `initialEditorState`, read once, gets the fetched content.
   */
  dataLoading?: boolean;
  /** Document mode: a header row with the caller's title and actions. */
  header?: DocumentHeader;
  /** Document mode: the document's name, for export file names and the exported title. */
  title?: string;
  /** Document mode: called once with the starting content, then after content changes (debounced). Caret moves alone do not call it. */
  onChange?: DocumentChangeHandler;
  /** Where uploads go. Without it (or without a `files` adapter), files stay in the page as local URLs. */
  imageScope?: ImageUploadScope;
  /** Starting content (Lexical JSON). Read once when the editor is created. */
  initialEditorState?: SerializedEditorState;
  /**
   * Document mode: load, save, versions, threads and live collaboration for
   * this document, through the `EditorProvider`'s adapters (`documents` is
   * required).
   */
  source?: DocumentSource;
  /** Who `@` can mention. Without it: the workspace (`workspaceId`), else nobody. */
  mentionScope?: MentionScope;
  /** Document mode with a source: save progress, for a "Saving…/Saved" label. */
  onSaveStatusChange?: (status: DocumentSaveStatus) => void;
  /** Document mode: called once the editor is ready, with imperative access. */
  onReady?: (handle: DocumentHandle) => void;
  containerClassName?: string;
  /** Comment mode: the composer is a placeholder until focused; its code and the emoji data load then, and it takes focus. */
  deferUntilFocus?: boolean;
  /** Comment mode: focus the composer once it mounts. */
  autoFocus?: boolean;
  actionLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onComment?: CommentSubmitHandler;
};
