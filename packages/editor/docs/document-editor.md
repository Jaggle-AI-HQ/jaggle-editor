# Document editor

`<LexicalEditor mode="document" />` edits page-sized rich text. It has a slash menu (`/`), Markdown shortcuts,
headings, lists and checklists, tables, columns, toggles, boards, polls, equations, code, quotes, images, video,
audio, files and embeds (YouTube, tweets). It can also have comments, version history, AI writing, import and
export, each turned on by a prop and an adapter.

The editor works in one of three ways:

| Way | Props | Who loads and saves |
|---|---|---|
| [Read-only](#read-only) | `readOnly` + `html` | Nothing is saved. No editor code loads. |
| [Local content](#local-content) | `html` or `initialEditorState`, plus `onChange` | The app |
| [Saved document](#saved-document) | `source` | The editor, through the `documents` adapter |

## Read-only

```tsx
<LexicalEditor mode="document" readOnly html={savedHtml} />
```

The HTML is sanitised with DOMPurify, which also allows the stored `jaggle-file:` scheme. The view keeps the
editor's look. Mentions render as chips, boards and embeds as their widgets, and stored files resolve through
`files.resolveUrl`. Empty HTML shows "Nothing to show." On the server, the view renders an empty line, because
sanitising needs the DOM.

## Local content

Without a `source`, the editor edits content the app owns. The app passes the starting content and saves the
changes itself:

```tsx
import { LexicalEditor, type DocumentChangeHandler } from "@jaggle-ai/editor";

function ReportBody({ report }: { report: Report }) {
  const save = useSaveReport(report.id);
  const onChange: DocumentChangeHandler = ({ html, editorState }) => {
    save.mutate({ html, state: editorState });
  };
  return (
    <div className="flex h-full flex-col">
      <LexicalEditor
        mode="document"
        initialEditorState={report.state ?? undefined}
        html={report.html}
        dataLoading={!report}
        onChange={onChange}
      />
    </div>
  );
}
```

- **Starting content.** `initialEditorState` (Lexical JSON) is used when given, else `html`. Both are read once,
  when the editor is created. Later prop changes don't reload the editor; give it a new `key` to start over.
- **`dataLoading`.** While the app's content is still fetching, `dataLoading` shows the loading state (with the
  header) and mounts the editor once it turns false, so the starting content is the fetched one.
- **`onChange({ html, editorState })`.** It runs once with the starting content, then 300 ms after each content
  change. `html` is what the read-only view renders, and `editorState` is the Lexical JSON. Caret moves alone don't
  call it. Debounce or batch your own saves on top if the backend needs it.
- Comment threads without a `source` live in the page only, so a reload loses them. Version history needs a
  `source`.

## Saved document

With a `source`, the editor loads, saves and (with `collaboration`) shares the document by itself:

```tsx
<LexicalEditor
  mode="document"
  source={{
    entityType: "task",
    entityId: task.id,
    documentKey: "main",
    roomId: `${workspaceId}:task-${task.id}`,
    initialHtml: task.description,
  }}
  workspaceId={workspaceId}
  mentionScope={{ type: "project", id: task.projectId }}
  imageScope={{ entityType: "task", entityId: task.id }}
  title={task.title}
  showComments
  showVersionHistory
  showImport
  showExport
  onSaveStatusChange={setSaveStatus}
/>
```

`DocumentSource`:

| Field | Meaning |
|---|---|
| `entityType`, `entityId` | The record the document belongs to (`"task"`, `"report"`…). Passed to every adapter call as the `DocumentIdentity`. |
| `documentKey` | Which of the record's documents. Defaults to `"main"`. |
| `roomId` | The live room's base name, unique per document, e.g. `` `${workspaceId}:task-${taskId}` ``. The editor adds `:lexical:r<revision>`. |
| `initialHtml` | Content to start from while nothing is saved yet, e.g. a description the API wrote. Saved content always wins. |

### Loading

1. `documents.load(identity)` returns the `StoredDocument`.
2. The editor opens `yjsState` (the saved Y.Doc) when it has one. Otherwise it starts from `html`, then
   `source.initialHtml`, then empty. HTML is imported only into a room that is still empty once synced, so people
   who join later don't import it twice.
3. The editor waits for `currentUser` (it shows the loading state while that is `null`).
4. With `collaboration`, it joins the room. If the server can't be reached, the document opens after 4 seconds
   anyway.

If the load fails, or returns `incomplete: true` with no `yjsState`, the editor doesn't open. It shows a notice with
**Retry** instead, because editing a partial copy would save it over the real document.

### Saving

- A save runs 3 seconds after the last **local** edit. Edits arriving from other people, and the load itself, are
  not saves of this person's work, so they don't trigger one.
- Each save sends the Y.Doc (base64) and the HTML to `documents.save`, with the latest `revision`.
- Pending changes are also saved when the tab is hidden and when the editor unmounts. `onReady`'s `flush()` saves
  them now (before navigating away, for example).
- **`onSaveStatusChange(status)`** reports `"saving"` (from an edit until its save returns), then `"saved"` or
  `"error"`. Nothing is reported before the first edit, so start your label at `"idle"`. Use it for a
  "Saving…/Saved" label.
- **Errors.** A failed save keeps the changes, shows "Couldn't save this document. Your changes are kept and will
  retry." once, and retries with the next edit.
- **Conflicts.** If `documents.conflictMessage(error)` returns a message, the save was refused because the document
  changed elsewhere. The editor stops saving and shows that message with a **Reload** action, which calls
  `onSaveConflict` (by default, `window.location.reload()`).
- **Automatic versions** (with `versions`): after 5 idle minutes with changes, at most one every 10 minutes.

### Revisions

`revision` lets a backend tell editor saves from writes made elsewhere (an automation, the AI planner, the API):

- An editor save keeps the revision. Return the stored revision from `documents.save`; the editor shares it with
  everyone in the room through the Y.Doc.
- A write from outside the editor should bump the revision and clear the stored Y.Doc. The next person to open the
  document then joins a new room, `…:r<new revision>`, seeded from the new HTML. They don't join the old room, whose
  content would otherwise be saved back over the write.
- Refuse a save sent with an older revision, and have `conflictMessage` recognise that error. People still in the
  old room then see the conflict notice and reload.

A backend without revisions can omit them. Everyone then shares one room (`…:r0`) and saves are never refused.

## Layout and props

The editor fills its container (`h-full`, flex column) and scrolls inside it, so give the container a height:

```tsx
<div className="flex h-[calc(100vh-4rem)] flex-col">
  <LexicalEditor mode="document" page /* … */ />
</div>
```

| Prop | Default | What it does |
|---|---|---|
| `page` | `false` | A centred reading column (max width 4xl) with generous padding, for full-page documents. Without it the editor fills the container's width, for a field inside a form or panel. |
| `sideMenu` | `true` | Block handles beside each block, to drag blocks and open the block menu. |
| `placeholder` | "Press '/' for menus and '@' for mentions" | The empty line's hint. |
| `header` | none | A header row: `{ start, end, trailing }`. See [The header](#the-header). |
| `title` | none | The document's name, used for export file names and the exported title. |
| `containerClassName` | none | Extra classes on the editor's container. |
| `workspaceId` | none | Scopes workspace lookups (board assignees, AI credits, mention hover cards). It is also the mention scope when `mentionScope` is unset. |
| `mentionScope` | the workspace | Who `@` lists: `{ type: "project" \| "workspace", id }`. Without it and without `workspaceId`, nobody. Needs `people`. |
| `imageScope` | none | Where uploads belong: `{ entityType, entityId, fieldName? }`. Without it (or without `files`), files stay in the page as local URLs. |
| `showComments` | `false` | Comment threads: highlight text or select media, then comment. Opens a comments sidebar. |
| `showVersionHistory` | `false` | The versions sidebar: list, preview, name and restore versions. Needs `source` and `versions`. |
| `showImport` | `false` | Import Word, HTML and Markdown files. PDF import also needs `importer`. |
| `showExport` | `false` | Export as HTML and Markdown. PDF and Word also need `exporter`. |
| `onReady` | none | Called once the editor is ready, with a [`DocumentHandle`](#imperative-access-onready). |

AI writing (the AI menu and "Ask AI" in the slash menu and toolbar) appears whenever the `ai` adapter exists. There's
no prop for it.

### The header

`header` adds a sticky row above the content. The app owns what goes in it, and the editor adds its own actions
(comments, versions, ⋯) after `end`:

```tsx
<LexicalEditor
  mode="document"
  source={source}
  header={{
    start: <DocumentTitle title={doc.title} onRename={rename} />,
    end: <SaveLabel status={saveStatus} />,
    trailing: <CloseSheetButton />, // after the editor's own actions
  }}
  showComments
  showVersionHistory
  showExport
/>
```

Without a header, the editor's actions sit in the editor's top corner.

Slot content renders inside the editor, so it can call `useDocumentUi()` to drive the editor:

```tsx
import { useDocumentUi } from "@jaggle-ai/editor";

function ExportPdfButton() {
  const ui = useDocumentUi();
  if (!ui.exportAs) return null; // export is off
  return <button onClick={() => ui.exportAs?.("pdf")}>Export PDF</button>;
}
```

`useDocumentUi()` returns:

| Field | |
|---|---|
| `showComments`, `openComments()` | Whether comments are on, and opens the comments sidebar |
| `openVersions?()` | Opens the versions sidebar. Unset when version history is off. |
| `openImport?()` | Opens the import dialog. Unset when import is off. |
| `exportAs?(format)` | Downloads the document as `"pdf"`, `"docx"`, `"html"` or `"markdown"`. Unset when export is off. |
| `openAi(anchor)` | Opens the AI menu at a point, `{ top, left }` |
| `workspaceId`, `mentionScope` | As passed to the editor |

### Imperative access (`onReady`)

`onReady(handle)` runs once the editor is ready. Keep the handle in a ref:

```tsx
import { useRef } from "react";

import { LexicalEditor, type DocumentHandle } from "@jaggle-ai/editor";

function GeneratedDocument({ source }: { source: DocumentSource }) {
  const handle = useRef<DocumentHandle | null>(null);

  const generate = async (prompt: string, signal: AbortSignal) => {
    const editor = handle.current;
    if (!editor) return;
    const before = editor.snapshot();
    try {
      await streamMarkdown(prompt, { signal, onText: (text) => editor.replaceWithMarkdown(text) });
      await editor.flush();
    } catch (error) {
      editor.restore(before); // put the document back after a cancelled or failed run
      throw error;
    }
  };

  return (
    <LexicalEditor mode="document" source={source} onReady={(ready) => (handle.current = ready)} />
  );
}
```

| Method | |
|---|---|
| `replaceWithMarkdown(markdown)` | Replaces the whole document. Call it repeatedly to stream text in. |
| `getMarkdown()`, `getHtml()` | The current content |
| `snapshot()`, `restore(state)` | Takes the current content as Lexical JSON, and puts it back |
| `flush()` | Saves pending changes now (saved documents); resolves when the save returns |

## Comments

With `showComments`, people select text (or click an image or video) and add a comment from the toolbar. Threads open
in a sidebar, with replies, mentions, emoji reactions, editing, deleting and resolving.

- Threads live in the document's Y.Doc, so everyone in the room sees them, and they are saved with the document.
- With the `threads` adapter, every change is also sent to the app, which can notify mentioned people. Threads
  written elsewhere are loaded, and an unread dot follows the server's read marker. See [Adapters](adapters.md#threads).
- Without a `source`, threads exist only while the page is open.

## Version history

`showVersionHistory`, with a `source` and the `versions` adapter, adds a versions sidebar. People can:
- see versions, newest first, and preview one;
- save the current content as a named version, and rename versions;
- restore a version, after confirming.

Automatic versions are made after 5 idle minutes of changes, at most one every 10 minutes.

## Import and export

- **Import** (`showImport`): Word (`.docx`), HTML and Markdown (`.md`, `.markdown`, `.txt`) convert in the browser.
  PDF (up to 50 MB and 50 pages) goes through `importer.pdfToHtml`. Importing replaces the document's content. On
  a document that isn't empty, the replacement is confirmed first, and one undo brings the old content back.
- **Export** (`showExport`): HTML and Markdown are built in the browser. PDF and Word are rendered by
  `exporter.render` from a complete HTML document with images embedded. A PDF or Word export is refused before
  rendering when that document is over 2 MB.

Two exports help pages that show a document without opening the editor:

- `DocumentExportDialog`: a dialog with the same formats as the Export menu, for saved HTML.

  ```tsx
  import { DocumentExportDialog } from "@jaggle-ai/editor";

  <DocumentExportDialog
    open={open}
    onOpenChange={setOpen}
    html={saved.html}
    title={doc.title}
    loading={isLoading}
    incomplete={saved.incomplete} // only part of the HTML came back: offer a retry instead
    onRetry={refetch}
    retrying={isFetching}
  />
  ```

- `exportDocumentHtml` in [`/headless`](headless-and-kit.md#exportdocumenthtml), the same thing without UI.

## Showing load problems yourself

`IncompleteDocumentNotice` is the notice the editor shows when a saved document only partly loaded or failed to
load. Use it in your own views of saved content:

```tsx
import { IncompleteDocumentNotice } from "@jaggle-ai/editor";

<IncompleteDocumentNotice
  purpose="view" // "edit" | "view" | "export"
  failed={query.isError} // didn't load at all, rather than partly
  onRetry={() => query.refetch()}
  retrying={query.isFetching}
/>
```
