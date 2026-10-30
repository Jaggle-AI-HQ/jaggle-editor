# Adapters

The editor never calls a backend itself. Everything it needs from the app comes through `EditorAdapters`, which
`EditorProvider` passes to every editor below it. Only `currentUser` is required. A feature whose adapter is
missing is hidden, or (for files) kept in the page only.

```tsx
import { EditorProvider, type EditorAdapters } from "@jaggle-ai-hq/editor";

const adapters = useMemo<EditorAdapters>(
  () => ({
    currentUser,
    people,
    files,
    documents,
    threads,
    versions,
    ai,
    exporter,
    importer,
    collaboration,
    notify: toast,
    onSaveConflict: () => router.refresh(),
  }),
  [currentUser /* and whatever else the adapters close over */],
);

<EditorProvider adapters={adapters}>{children}</EditorProvider>;
```

- **Keep the object stable** (`useMemo`, or a module-level constant). Editors re-read the adapters whenever the
  object changes.
- **Throw `Error`s with readable messages.** Where an adapter call fails in front of the person (an upload, an
  import), the editor shows the error's `message`.
- **Use the `signal`** where one is passed. The editor aborts requests it no longer needs (a closed dialog, a
  cancelled upload, a superseded search).
- Every TypeScript type below is exported from `@jaggle-ai-hq/editor`.
- The [playground's adapters](../../../apps/playground/src/adapters.ts) implement all of them in memory. The
  [package README](../README.md#from-jaggle-app-fes-services-to-adapters) maps each one to jaggle-app-fe's services.

The examples below call a made-up REST API through `api` (`api.get`, `api.post`…). Swap in your own client.

## At a glance

| Adapter | Used for | Without it |
|---|---|---|
| [`currentUser`](#currentuser) | Comment author, live cursor, version author | Required (`null` while loading) |
| [`people`](#people) | `@` mentions, mention hover cards, board assignees | No mentions |
| [`files`](#files) | Uploads, resolving stored files, attachment links, a file viewer | Files stay in the page as local URLs |
| [`documents`](#documents) | Loading and saving a `source` document | A `source` can't be used |
| [`threads`](#threads) | Sending comment threads to the app, unread state | Threads still work, inside the document |
| [`versions`](#versions) | Version history and automatic versions | No version history |
| [`ai`](#ai) | AI writing | No AI menu |
| [`exporter`](#exporter) | PDF and Word export | HTML and Markdown export only |
| [`importer`](#importer) | PDF import | Word, HTML and Markdown import only |
| [`collaboration`](#collaboration) | Live editing | The document is edited alone (still saved) |
| [`notify`](#notify) | Notices | `console` |
| [`onSaveConflict`](#onsaveconflict) | "Reload" after a refused save | `window.location.reload()` |

## `currentUser`

```ts
type EditorUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Cursor colour in live editing; one is picked from the id when unset. */
  color?: string;
};
```

Pass `null` while the user is loading. Saved documents (`source`) wait for it before opening, because their
comments, cursors and versions need an author.

## `people`

```ts
type PeopleAdapter = {
  search(
    scope: MentionScope, // { type: "project" | "workspace"; id: string }
    search: string, // "" lists everyone
    options: { limit: number; signal?: AbortSignal },
  ): Promise<EditorPerson[]>;
  get(id: string, options: { workspaceId?: string; signal?: AbortSignal }): Promise<EditorPerson | null>;
};

type EditorPerson = { id: string; name: string; email?: string | null; avatarUrl?: string | null };
```

- `search` feeds the `@` list (as people type) and board assignee pickers. Match on name or email, return at most
  `limit`, and for a workspace list active members only.
- `get` fills a mention's hover card. Return `null` for someone unknown. Results are cached for 5 minutes.
- A person shows as their `name`, else their `email`.

```ts
const people: PeopleAdapter = {
  search: (scope, search, { limit, signal }) =>
    api.get(`/${scope.type}s/${scope.id}/members`, { params: { search, limit, status: "active" }, signal }),
  get: (id, { signal }) => api.get(`/users/${id}`, { signal }).catch(() => null),
};
```

## `files`

```ts
type FilesAdapter = {
  upload(
    file: File,
    scope: UploadScope & { fieldName: string },
    options: { onProgress?: (progress: number) => void; signal?: AbortSignal },
  ): Promise<UploadedFile>; // { attachmentId: string; url?: string }
  resolveUrl(src: string): Promise<string>;
  rawUrl?(attachmentId: string): Promise<string>;
  FileViewer?: ComponentType<FileViewerProps>;
};

type UploadScope = { entityType: string; entityId: string; fieldName?: string };
```

- **`upload`** stores a file for the record in `scope` (the editor's `imageScope` prop). `fieldName` is the
  editor's, or `"document_asset"` (documents) / `"comment_image"` (comments) when `imageScope` doesn't set one.
  Report progress from 0 to 1, and stop when `signal` aborts. The editor stores the result in the content as
  `jaggle-file://attachment/<attachmentId>`, never as a URL, so the content survives expiring links. A `url` in the
  result is shown right away.
- **`resolveUrl`** turns a stored source into something the browser can load. It gets a `jaggle-file://` reference
  (return a signed URL, say) or an older stored URL. Return `src` unchanged when there's nothing to resolve. It's
  called whenever stored media renders, in editors and read-only views.
- **`rawUrl`** (optional) is a lasting link to an attachment, written into a posted comment's HTML in place of the
  preview URL.
- **`FileViewer`** (optional) opens an attachment full size: `{ file: { id, url, name, mimeType?, size? }, open,
  onOpenChange }`. Without it, attachments open in a new tab.

Without `files`, or when the editor has no `imageScope`, uploads stay in the page as local object URLs. Those are
fine for a preview and lost on reload.

```ts
const files: FilesAdapter = {
  upload: async (file, scope, { onProgress, signal }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("entity_type", scope.entityType);
    form.append("entity_id", scope.entityId);
    form.append("field_name", scope.fieldName);
    const saved = await api.post("/files/upload", form, {
      signal,
      onUploadProgress: (event) => event.total && onProgress?.(event.loaded / event.total),
    });
    return { attachmentId: saved.id, url: saved.signed_url };
  },
  resolveUrl: async (src) => {
    const match = /^jaggle-file:\/\/attachment\/(.+)$/.exec(src);
    if (!match) return src;
    const file = await api.get(`/files/${decodeURIComponent(match[1])}`);
    return file.signed_url;
  },
  rawUrl: async (attachmentId) => `${API_URL}/files/${attachmentId}/raw`,
};
```

## `documents`

Needed for a `source` document. See [Saved document](document-editor.md#saved-document) for what the editor does
with it.

```ts
type DocumentsAdapter = {
  load(identity: DocumentIdentity, options: { signal?: AbortSignal }): Promise<StoredDocument>;
  save(
    identity: DocumentIdentity,
    document: { yjsState: string; html: string; revision?: number },
  ): Promise<{ revision?: number | null } | void>;
  conflictMessage?(error: unknown): string | null;
};

type DocumentIdentity = { entityType: string; entityId: string; documentKey?: string }; // "main" when unset

type StoredDocument = {
  yjsState: string | null; // the Y.Doc, base64; opens the document when present
  html: string; // for documents last written outside the editor
  revision?: number | null;
  incomplete?: boolean; // only part of `html` came back
};
```

- **`load`** returns what's stored. A document never saved by the editor has `yjsState: null` and its HTML (or
  `""`).
- **`save`** stores both the Y.Doc and the HTML. Keep the HTML: other views, search and exports read it, and it
  seeds the room after a write from outside the editor. Return the stored `revision`.
- **Refuse stale saves.** When `revision` is older than the stored one, reject, and have `conflictMessage(error)`
  return a message for that error (`null` for any other error). The editor then stops saving and offers a reload.
  See [Revisions](document-editor.md#revisions).

```ts
const documents: DocumentsAdapter = {
  load: async ({ entityType, entityId, documentKey = "main" }, { signal }) => {
    const row = await api.get(`/${entityType}/${entityId}/editor-state`, { params: { documentKey }, signal });
    return {
      yjsState: row.yjs_state,
      html: row.content ?? "",
      revision: row.revision,
      incomplete: row.content_truncated,
    };
  },
  save: async ({ entityType, entityId, documentKey = "main" }, { yjsState, html, revision }) => {
    const row = await api.put(`/${entityType}/${entityId}/editor-state`, {
      document_key: documentKey,
      yjs_state: yjsState,
      content: html,
      content_format: "html",
      state_format: "lexical",
      revision,
    });
    return { revision: row.revision };
  },
  conflictMessage: (error) =>
    isApiError(error) && error.status === 409 ? "This document changed elsewhere. Reload the page." : null,
};
```

## `threads`

Comment threads live in the document's Y.Doc, so they work, and are saved with the document, without this adapter.
With it:
- every change is also sent to the app, which can notify mentioned people and list comments elsewhere;
- threads written elsewhere are loaded into the document;
- an unread dot follows the server's read marker.

```ts
type ThreadsAdapter = {
  list(identity: DocumentIdentity): Promise<EditorThread[]>;
  create(identity, thread: {
    id: string;
    initialComment: { id: string; body: unknown };
    metadata: ThreadMetadata; // { anchor: "text" | "media"; quote: string }
    mentionedUserIds: string[];
  }): Promise<unknown>;
  addComment(identity, threadId: string, comment: { id: string; body: unknown; mentionedUserIds: string[] }): Promise<unknown>;
  updateComment(identity, threadId: string, commentId: string, comment: { body: unknown; mentionedUserIds: string[] }): Promise<unknown>;
  deleteComment(identity, threadId: string, commentId: string): Promise<unknown>;
  deleteThread(identity, threadId: string): Promise<unknown>;
  setResolved(identity, threadId: string, resolved: boolean): Promise<unknown>;
  addReaction(identity, threadId: string, commentId: string, emoji: string): Promise<unknown>;
  removeReaction(identity, threadId: string, commentId: string, emoji: string): Promise<unknown>;
  getReadState?(identity): Promise<string | null>; // ISO time, null before the first visit
  saveReadState?(identity, lastReadAt: string): Promise<unknown>;
};
```

- **Ids come from the editor.** Threads and comments get their ids in the browser (they exist in the Y.Doc
  first). Store them as given.
- **`body`** is the editor's `CommentBody` (`{ format: "lexical", state, html, text }`). Store it as it is.
- **`mentionedUserIds`** on `updateComment` is every mention in the edited comment, replacing the stored set.
- **`list`** returns threads with their comments (`EditorThread`, `EditorThreadComment`): ids, `createdAt`, `resolved`,
  `metadata`, and per comment `userId`, `body`, `createdAt`, `updatedAt`, optional `reactions` (`{ emoji,
  createdAt, userIds }`) and `author` (`{ id, name, avatar_url }`).
- **`saveReadState`** should keep the later of the stored and sent times.

## `versions`

Turns on version history (`showVersionHistory`) and automatic versions.

```ts
type VersionsAdapter = {
  list(identity, options: { limit: number }): Promise<EditorVersionSummary[]>; // newest first
  get(identity, versionId: string): Promise<EditorVersion>;
  create(identity, version: NewVersion): Promise<unknown>;
  rename(identity, versionId: string, name: string): Promise<unknown>;
};

type EditorVersionSummary = {
  id: string;
  number: number;
  name: string | null;
  auto: boolean; // made automatically
  createdAt: string;
  author?: { id: string; name: string } | null;
};

type EditorVersion = EditorVersionSummary & {
  stateFormat?: string; // only "lexical" snapshots restore as they are
  snapshotState?: string | null; // the Y.Doc, base64
  html?: string | null; // for previews, and for restoring older versions
};

type NewVersion = {
  state: string; // the Y.Doc, base64
  html: string;
  text: string; // the start of the text, for listings
  name?: string;
  changeSummary?: string; // e.g. "120 words"
  auto: boolean;
};
```

A snapshot from another editor (a `stateFormat` other than `"lexical"`, like the old BlockNote editor's) is
previewed and restored from its `html`.

## `ai`

Turns on AI writing: the AI menu, and "Ask AI" in the slash menu and the selection toolbar.

```ts
type AiAdapter = {
  stream(
    request: DocumentAiRequest,
    options: { signal: AbortSignal; onText: (text: string) => void },
  ): Promise<string>;
  credits?: {
    useShortfall(workspaceId: string | undefined): CreditShortfall | null; // a React hook
    usageHref?(workspaceId: string): string;
    Badge?: ComponentType<{ workspaceId: string; className?: string }>;
  };
};

type DocumentAiRequest = {
  workspaceId: string; // "" when the editor has no workspaceId
  userPrompt: string;
  actionKey: string; // the menu item picked (its key), or "manual" for a typed prompt
  mode: "replace-selection" | "insert-after-cursor" | "insert-before-document" | "append-document";
  documentMarkdown: string;
  selectionMarkdown: string;
  cursorBlockMarkdown: string;
};
```

- **`stream`** sends the request to your AI service and streams back **Markdown**. Call `onText` with the full text
  so far (not the newest chunk). Resolve with the final text. When `signal` aborts, reject with its `AbortError`.
- **Errors.** Reject with an object that has `status: 402` and `body: { required, available, reset_date }` when the
  person is out of credits, or `status: 429` when rate limited. The editor shows a specific notice for each. Any
  other rejection shows a generic "failed" message in the menu, and an empty result says so too. **Stop** aborts the
  signal, and whatever text has arrived can still be applied.
- **`credits`** (optional): `useShortfall` is a React hook, called in the AI menu, that returns `{ required,
  available, resetDate? }` when the person can't afford a run (or `null`). `usageHref` links to the usage page, and
  `Badge` is shown beside Run.

```ts
const ai: AiAdapter = {
  stream: async (request, { signal, onText }) => {
    const response = await fetch(`${API_URL}/ai/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      throw Object.assign(new Error("The AI request failed."), {
        status: response.status,
        body: await response.json().catch(() => null),
      });
    }
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text;
      text += value;
      onText(text);
    }
  },
};
```

## `exporter`

```ts
type ExportAdapter = { render(format: "pdf" | "docx", html: string): Promise<Blob> };
```

Renders a complete HTML document (images embedded) as PDF or Word, usually on a server (a headless
browser for PDF, a converter for Word). It turns on PDF and Word in the Export menu, `DocumentExportDialog` and
`exportDocumentHtml`. The editor refuses documents over 2 MB of HTML before calling it.

```ts
const exporter: ExportAdapter = {
  render: async (format, html) => {
    const response = await fetch(`/api/export/${format}`, { method: "POST", body: html });
    if (!response.ok) throw new Error(`Couldn't export as ${format.toUpperCase()}.`);
    return response.blob();
  },
};
```

## `importer`

```ts
type ImportAdapter = {
  pdfToHtml(
    file: File,
    scope: UploadScope, // the editor's imageScope
    options: { signal?: AbortSignal; onProcessing?: () => void },
  ): Promise<string>;
};
```

Converts a PDF (at most 50 MB, 50 pages) to HTML on your server. Call `onProcessing` once the upload is done and
conversion starts, so the dialog can say so. PDF import also needs the editor's `imageScope` (the PDF's images
belong to that record). Word, HTML and Markdown import never need an adapter.

## `collaboration`

```ts
type CollaborationAdapter = {
  url: string; // the y-websocket server, e.g. "wss://example.com/yjs-ws"
  webSocketFor?(room: CollaborationRoom): typeof WebSocket;
};

type CollaborationRoom = DocumentIdentity & { documentKey: string; room: string };
```

Joins `source` documents to a live room. `webSocketFor` returns the WebSocket class for one room, for example one
that authorises the socket. See [Live collaboration](collaboration.md).

## `notify`

```ts
type EditorNotify = {
  success(message: string, options?: NoticeOptions): unknown;
  error(message: string, options?: NoticeOptions): unknown;
  message(message: string, options?: NoticeOptions): unknown;
  promise<T>(promise: Promise<T>, messages: {
    loading: string;
    success: string;
    error: string | ((error: unknown) => string);
  }): unknown;
};

type NoticeOptions = {
  description?: string;
  duration?: number; // milliseconds; Infinity keeps it until dismissed
  action?: { label: string; onClick: () => void };
};
```

This is the part of [sonner](https://sonner.emilkowal.ski)'s `toast` the editor uses, so an app on sonner passes
`notify: toast`. Other apps wrap their own notices in this shape. Without it, notices go to the console, so people
won't see errors.

## `onSaveConflict`

```ts
onSaveConflict?: () => void;
```

When a save is refused (see [`documents`](#documents)), the notice offers a **Reload** action that calls this. The
default reloads the page. An app with its own way to reload (refetching and remounting the editor, say) can pass it
here.
