import type { ComponentType } from "react";

/**
 * What the editor needs from the app it runs in. Everything that talks to a
 * backend comes through these adapters, so one editor works in any app. Only
 * `currentUser` is required; a feature whose adapter is missing is hidden (or,
 * for files, kept in the page only).
 */
export type EditorAdapters = {
  /** Who is editing: comment author, live cursor, version author. `null` while it loads. */
  currentUser: EditorUser | null;
  people?: PeopleAdapter;
  files?: FilesAdapter;
  documents?: DocumentsAdapter;
  threads?: ThreadsAdapter;
  versions?: VersionsAdapter;
  ai?: AiAdapter;
  exporter?: ExportAdapter;
  importer?: ImportAdapter;
  collaboration?: CollaborationAdapter;
  notify?: EditorNotify;
  /**
   * A save was refused because the document changed elsewhere. The notice
   * offers this as "Reload"; the default reloads the page.
   */
  onSaveConflict?: () => void;
};

/** A saved document: an entity's text field, e.g. a task's description. */
export type DocumentIdentity = {
  entityType: string;
  entityId: string;
  /** Which of the entity's documents; "main" when unset. */
  documentKey?: string;
};

export type EditorUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Cursor colour in live editing; one is picked from the id when unset. */
  color?: string;
};

// People

/** Who `@` can mention: a project's members or a workspace's. */
export type MentionScope = { type: "project" | "workspace"; id: string };

export type EditorPerson = {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export type PeopleAdapter = {
  /**
   * People in a project or workspace whose name or email matches `search`
   * (every one when empty), at most `limit`. Workspaces list active members.
   */
  search: (
    scope: MentionScope,
    search: string,
    options: { limit: number; signal?: AbortSignal },
  ) => Promise<EditorPerson[]>;
  /** One person, for a mention's hover card; `null` when unknown. */
  get: (
    id: string,
    options: { workspaceId?: string; signal?: AbortSignal },
  ) => Promise<EditorPerson | null>;
};

// Files

/** Where uploads belong: the entity the document is part of. */
export type UploadScope = {
  entityType: string;
  entityId: string;
  /** The entity's field; the editor sends "document_asset", or "comment_image" for comments, when unset. */
  fieldName?: string;
};

export type UploadedFile = {
  /** Stored in the content as `jaggle-file://attachment/<attachmentId>`. */
  attachmentId: string;
  /** A URL to show the file right away, if the upload returned one. */
  url?: string;
};

export type FileViewerProps = {
  file: { id: string; url: string; name: string; mimeType?: string; size?: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type FilesAdapter = {
  /** Uploads a file. Reject with an `Error` whose message can be shown. */
  upload: (
    file: File,
    scope: UploadScope & { fieldName: string },
    options: { onProgress?: (progress: number) => void; signal?: AbortSignal },
  ) => Promise<UploadedFile>;
  /**
   * A URL the browser can load for a stored source: a `jaggle-file://`
   * reference (usually a signed URL) or an older stored URL. Return `src`
   * unchanged when there is nothing to resolve.
   */
  resolveUrl: (src: string) => Promise<string>;
  /** A lasting link to an attachment, written into a posted comment's HTML. */
  rawUrl?: (attachmentId: string) => Promise<string>;
  /** Opens an attachment full size; without one, it opens in a new tab. */
  FileViewer?: ComponentType<FileViewerProps>;
};

// Saved documents

export type StoredDocument = {
  /** The Y.Doc, base64. Opens the document when present. */
  yjsState: string | null;
  /** HTML, for documents last written outside the editor. */
  html: string;
  /** Moves when the document is written outside the editor (see the README). */
  revision?: number | null;
  /** Only part of `html` came back; with no `yjsState` the editor waits for a retry. */
  incomplete?: boolean;
};

export type DocumentsAdapter = {
  load: (identity: DocumentIdentity, options: { signal?: AbortSignal }) => Promise<StoredDocument>;
  /**
   * Saves the Y.Doc and its HTML. Refuse (reject) a save from an older
   * revision; `conflictMessage` tells the editor that refusal apart.
   */
  save: (
    identity: DocumentIdentity,
    document: { yjsState: string; html: string; revision?: number },
  ) => Promise<{ revision?: number | null } | void>;
  /** The message for a refused save (the document changed elsewhere), else `null`. */
  conflictMessage?: (error: unknown) => string | null;
};

// Comment threads

export type EditorThreadComment = {
  id: string;
  userId: string;
  /** The editor's `CommentBody`. */
  body: unknown;
  createdAt: string;
  updatedAt: string;
  reactions?: { emoji: string; createdAt: string; userIds: string[] }[];
  author?: { id: string; name: string; avatar_url: string | null } | null;
};

export type EditorThread = {
  id: string;
  createdAt: string;
  resolved: boolean;
  /** What the editor stored: `{ anchor: "text" | "media", quote: string }`. */
  metadata?: unknown;
  comments: EditorThreadComment[];
};

export type ThreadMetadata = { anchor: "text" | "media"; quote: string };

/**
 * Comments live in the document's Y.Doc, so they work without this adapter.
 * With it, every change is also sent to the app (to notify mentioned people),
 * threads written elsewhere are loaded, and the unread dot follows the
 * server's read marker.
 */
export type ThreadsAdapter = {
  list: (identity: DocumentIdentity) => Promise<EditorThread[]>;
  create: (
    identity: DocumentIdentity,
    thread: {
      id: string;
      initialComment: { id: string; body: unknown };
      metadata: ThreadMetadata;
      mentionedUserIds: string[];
    },
  ) => Promise<unknown>;
  addComment: (
    identity: DocumentIdentity,
    threadId: string,
    comment: { id: string; body: unknown; mentionedUserIds: string[] },
  ) => Promise<unknown>;
  /** `mentionedUserIds` is every mention in the comment, replacing the stored set. */
  updateComment: (
    identity: DocumentIdentity,
    threadId: string,
    commentId: string,
    comment: { body: unknown; mentionedUserIds: string[] },
  ) => Promise<unknown>;
  deleteComment: (identity: DocumentIdentity, threadId: string, commentId: string) => Promise<unknown>;
  deleteThread: (identity: DocumentIdentity, threadId: string) => Promise<unknown>;
  setResolved: (identity: DocumentIdentity, threadId: string, resolved: boolean) => Promise<unknown>;
  addReaction: (
    identity: DocumentIdentity,
    threadId: string,
    commentId: string,
    emoji: string,
  ) => Promise<unknown>;
  removeReaction: (
    identity: DocumentIdentity,
    threadId: string,
    commentId: string,
    emoji: string,
  ) => Promise<unknown>;
  /** When the current person last read the comments; `null` before their first visit. */
  getReadState?: (identity: DocumentIdentity) => Promise<string | null>;
  /** Keep the later of the stored and sent times. */
  saveReadState?: (identity: DocumentIdentity, lastReadAt: string) => Promise<unknown>;
};

// Versions

export type EditorVersionSummary = {
  id: string;
  number: number;
  name: string | null;
  auto: boolean;
  createdAt: string;
  author?: { id: string; name: string } | null;
};

export type EditorVersion = EditorVersionSummary & {
  /** Which editor the snapshot belongs to; only "lexical" snapshots restore as-is. */
  stateFormat?: string;
  /** The snapshot's Y.Doc, base64. */
  snapshotState?: string | null;
  /** The snapshot's HTML, for previews and for restoring older versions. */
  html?: string | null;
};

export type NewVersion = {
  /** The Y.Doc, base64. */
  state: string;
  html: string;
  /** The start of the text, for listings. */
  text: string;
  name?: string;
  changeSummary?: string;
  auto: boolean;
};

export type VersionsAdapter = {
  /** Newest first. */
  list: (identity: DocumentIdentity, options: { limit: number }) => Promise<EditorVersionSummary[]>;
  get: (identity: DocumentIdentity, versionId: string) => Promise<EditorVersion>;
  create: (identity: DocumentIdentity, version: NewVersion) => Promise<unknown>;
  rename: (identity: DocumentIdentity, versionId: string, name: string) => Promise<unknown>;
};

// AI writing

/** Where a result goes in the document; the server shapes its output for it. */
export type DocumentAiMode =
  | "replace-selection"
  | "insert-after-cursor"
  | "insert-before-document"
  | "append-document";

export type DocumentAiRequest = {
  workspaceId: string;
  userPrompt: string;
  actionKey: string;
  mode: DocumentAiMode;
  documentMarkdown: string;
  selectionMarkdown: string;
  cursorBlockMarkdown: string;
};

export type CreditShortfall = { required: number; available: number; resetDate?: string };

export type AiAdapter = {
  /**
   * Streams the Markdown result. `onText` gets the full text so far; the
   * promise resolves with the final text. Aborting rejects with the signal's
   * `AbortError`. A rejection with `status` 402 (body `{ required, available,
   * reset_date }`) means out of credits; 429 means rate limited.
   */
  stream: (
    request: DocumentAiRequest,
    options: { signal: AbortSignal; onText: (text: string) => void },
  ) => Promise<string>;
  credits?: {
    /** A hook: the shortfall before a run, or `null` when there are enough (or it's unknown). */
    useShortfall: (workspaceId: string | undefined) => CreditShortfall | null;
    /** Where people see their usage. */
    usageHref?: (workspaceId: string) => string;
    /** Shown beside Run, e.g. the remaining credits. */
    Badge?: ComponentType<{ workspaceId: string; className?: string }>;
  };
};

// Import and export

export type ExportAdapter = {
  /** Renders a complete HTML document (images embedded) as PDF or Word. */
  render: (format: "pdf" | "docx", html: string) => Promise<Blob>;
};

export type ImportAdapter = {
  /** Converts a PDF to HTML for the document `scope` belongs to. */
  pdfToHtml: (
    file: File,
    scope: UploadScope,
    options: { signal?: AbortSignal; onProcessing?: () => void },
  ) => Promise<string>;
};

// Live editing

/** One live room, for authorising its socket. */
export type CollaborationRoom = DocumentIdentity & { documentKey: string; room: string };

export type CollaborationAdapter = {
  /** The y-websocket server, e.g. `wss://example.com/yjs-ws`. */
  url: string;
  /**
   * A WebSocket class for one room (y-websocket's `WebSocketPolyfill`), e.g.
   * one that sends an auth ticket. The browser's WebSocket when unset.
   */
  webSocketFor?: (room: CollaborationRoom) => typeof WebSocket;
};

// Notices

export type NoticeOptions = {
  description?: string;
  /** Milliseconds; `Infinity` keeps it until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

/** The subset of sonner's `toast` the editor uses, so an app on sonner can pass `toast` itself. */
export type EditorNotify = {
  success: (message: string, options?: NoticeOptions) => unknown;
  error: (message: string, options?: NoticeOptions) => unknown;
  message: (message: string, options?: NoticeOptions) => unknown;
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string | ((error: unknown) => string);
    },
  ) => unknown;
};
