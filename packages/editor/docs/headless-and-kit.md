# Headless and kit

Two extra entry points cover work outside `LexicalEditor`:

| Import | For |
|---|---|
| `@jaggle-ai/editor/headless` | Converting and exporting saved content without showing an editor |
| `@jaggle-ai/editor/kit` | Building a small editor of your own that looks and behaves like this one |

Both are separate bundles, so a page that only imports the main entry doesn't load them.

## `/headless`

### `documentHtmlFromMarkdown`

```ts
import { documentHtmlFromMarkdown } from "@jaggle-ai/editor/headless";

const html: string = documentHtmlFromMarkdown(markdown);
```

Turns Markdown (AI output, say) into the HTML the document editor saves for the same content. Save that HTML as a
document's content (`StoredDocument.html` with no `yjsState`), and the editor opens it as if it had been typed.

The main entry has a lazy version, which loads the converter on first use:

```ts
import { markdownToDocumentHtml } from "@jaggle-ai/editor";

const html = await markdownToDocumentHtml(markdown);
```

### `exportDocumentHtml`

```ts
import { exportDocumentHtml } from "@jaggle-ai/editor/headless";

await exportDocumentHtml(saved.html, "pdf", doc.title, { files, exporter });
```

Downloads saved HTML in an export format, with the same output as the editor's Export menu. Use it on pages that
list documents without opening them.

| Argument | |
|---|---|
| `html` | The document's saved HTML |
| `format` | `"pdf"`, `"docx"`, `"html"` or `"markdown"` |
| `title` | Optional. The file name and the exported title. |
| `services` | `{ files?: { resolveUrl }, exporter? }`. `files.resolveUrl` embeds stored images. `exporter` is needed for PDF and Word. |

For PDF and Word, it rejects with a readable `Error` when there's no `exporter`, or when the export document is
over 2 MB of HTML. For a ready-made dialog, use `DocumentExportDialog` from the main
entry (see [Document editor](document-editor.md#import-and-export)).

The adapters from `useEditorAdapters()` fit the `services` argument directly:

```tsx
import { useEditorAdapters } from "@jaggle-ai/editor";

function DownloadButton({ html, title }: { html: string; title: string }) {
  const { files, exporter } = useEditorAdapters();
  return (
    <button onClick={() => void exportDocumentHtml(html, "docx", title, { files, exporter })}>Download</button>
  );
}
```

### `createHeadlessDocumentEditor`

```ts
import { createHeadlessDocumentEditor } from "@jaggle-ai/editor/headless";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $getRoot, $insertNodes } from "lexical";

const editor = createHeadlessDocumentEditor();
try {
  editor.update(
    () => {
      const dom = new DOMParser().parseFromString(savedHtml, "text/html");
      const root = $getRoot();
      root.clear();
      root.select();
      $insertNodes($generateNodesFromDOM(editor, dom));
    },
    { discrete: true },
  );
  const text = editor.getEditorState().read(() => $getRoot().getTextContent());
  const html = editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null));
} finally {
  editor.dispose();
}
```

A Lexical editor with every node the document editor has and no view. Use it for your own work on saved content:
extracting text, rewriting HTML, running a migration. Pass `{ discrete: true }` to `update` so the change applies at
once, and `dispose()` the editor when done. It needs a DOM for HTML parsing (a browser, or jsdom/happy-dom in Node).

## `/kit`

For a small editor built on Lexical's `LexicalExtensionComposer` that should match this one (jaggle-app-fe's sticky
notes, for example).

| Export | |
|---|---|
| `editorTheme` (also `documentTheme`, `commentTheme`) | The Lexical theme: the class names for every node, as Tailwind classes |
| `ToolbarToggle` | A pressed/unpressed toolbar button with a tooltip: `{ label, pressed?, onPressed, className?, children }` |
| `ToolbarIconButton` | A toolbar action button with a tooltip: `{ label, pressed?, onClick, children }` |
| `$getActiveTextFormats(selection)` | The text formats (`"bold"`, `"italic"`…) applied across a range selection, to show pressed states |
| `EditorErrorBoundary` | The error boundary the editor gives Lexical (`ReactExtension`'s `ErrorBoundary`) |
| `commentBody`, `toCommentPayload`, `mentionDraft`, `mentionedUserIds` | The comment payload helpers (see [Comment composer](comment-composer.md#posting)) |

Toolbar buttons keep the editor's selection when pressed: they prevent the mousedown that would blur it.

```tsx
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ReactExtension } from "@lexical/react/ReactExtension";
import { RichTextExtension } from "@lexical/rich-text";
import { HistoryExtension } from "@lexical/history";
import { $getSelection, $isRangeSelection, configExtension, defineExtension, FORMAT_TEXT_COMMAND } from "lexical";
import { useEffect, useState } from "react";

import { $getActiveTextFormats, EditorErrorBoundary, editorTheme, ToolbarToggle } from "@jaggle-ai/editor/kit";

const noteExtension = defineExtension({
  name: "sticky-note",
  namespace: "StickyNote",
  theme: editorTheme,
  dependencies: [
    RichTextExtension,
    HistoryExtension,
    configExtension(ReactExtension, { ErrorBoundary: EditorErrorBoundary }),
  ],
});

function BoldButton() {
  const [editor] = useLexicalComposerContext();
  const [bold, setBold] = useState(false);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(() => {
          const selection = $getSelection();
          setBold($isRangeSelection(selection) && $getActiveTextFormats(selection).includes("bold"));
        }),
      ),
    [editor],
  );
  return (
    <ToolbarToggle label="Bold (⌘B)" pressed={bold} onPressed={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
      <strong>B</strong>
    </ToolbarToggle>
  );
}

export function StickyNote() {
  return (
    <LexicalExtensionComposer extension={noteExtension} contentEditable={null}>
      <BoldButton />
      <ContentEditable className="min-h-24 outline-none" />
    </LexicalExtensionComposer>
  );
}
```
