# Getting started

This guide adds a working editor to a React 19 app in five steps. It starts with no backend at all. The
[adapters guide](adapters.md) then connects it to yours.

## 1. Install the package and its peers

For now the package is on GitHub Packages, published as `@jaggle-ai-hq/editor`. Installing needs the `@jaggle-ai-hq`
registry and a token with `read:packages`; the [package README](../README.md#install) has the `.yarnrc.yml` and `.npmrc`
setup. Install it under its real name with an alias, so imports say `@jaggle-ai/editor`:

```bash
yarn add @jaggle-ai/editor@npm:@jaggle-ai-hq/editor@^0.2.0
```

Once it's on npm, install `@jaggle-ai/editor` itself, with no token.

Then install the peer dependencies. Each peer must exist once in the app:

```bash
npm install @tanstack/react-query yjs lexical @lexical/clipboard @lexical/code @lexical/code-shiki @lexical/extension @lexical/history @lexical/html @lexical/link @lexical/list @lexical/mark @lexical/markdown @lexical/react @lexical/rich-text @lexical/selection @lexical/table @lexical/text @lexical/utils @lexical/yjs
```

Keep `lexical` and every `@lexical/*` package on the same `0.51.x` version. Mixed versions break the editor at
runtime (see [Troubleshooting](troubleshooting.md#lexical-or-yjs-is-loaded-twice)).

## 2. Add the styles

In the app's main stylesheet, after `@import "tailwindcss"`:

```css
@import "tw-animate-css";
@import "@jaggle-ai/editor/styles.css";
@source "../node_modules/@jaggle-ai/editor/dist"; /* path from this CSS file */
```

The editor uses the standard shadcn/ui theme variables (`--background`, `--primary`, `--border`…). An app built on
shadcn/ui already has them. Otherwise see [Styling](styling.md).

## 3. Wrap the app in the providers

The editor needs two providers above it:
- a TanStack Query `QueryClientProvider` (reuse the app's own if it has one);
- an `EditorProvider` with the app's adapters.

Only `currentUser` is required. Every other adapter turns on a feature (mentions, uploads, saving…).

```tsx
"use client";

import { useMemo, type ReactNode } from "react";

import { EditorProvider, type EditorAdapters, type EditorUser } from "@jaggle-ai/editor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClient = new QueryClient();

export function EditorProviders({
  user,
  children,
}: {
  /** The signed-in person; `null` while it loads. */
  user: EditorUser | null;
  children: ReactNode;
}) {
  // A stable object: editors re-read the adapters whenever it changes.
  const adapters = useMemo<EditorAdapters>(
    () => ({ currentUser: user, notify: toast }),
    [user],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <EditorProvider adapters={adapters}>{children}</EditorProvider>
    </QueryClientProvider>
  );
}
```

Every query the editor runs has a key starting with `"@jaggle-ai/editor"`, so it can share the app's query
client without clashing with the app's own queries.

## 4. Render an editor

A document with content the app keeps itself:

```tsx
import { useState } from "react";

import { LexicalEditor } from "@jaggle-ai/editor";

export function NotesField({ initialHtml }: { initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);
  return (
    <div className="flex h-[32rem] flex-col rounded-xl border">
      <LexicalEditor
        mode="document"
        html={initialHtml}
        placeholder="Write something…"
        onChange={(content) => setHtml(content.html)}
      />
    </div>
  );
}
```

`html` is read once, when the editor is created. `onChange` runs once with the starting content, then 300 ms after
each content change. Moving the caret doesn't call it.

To show the saved HTML without loading the editor:

```tsx
<LexicalEditor mode="document" readOnly html={savedHtml} />
```

A comment box:

```tsx
<LexicalEditor
  mode="comment"
  actionLabel="Comment"
  onComment={async (state, html, text) => {
    await postComment({ state, html, text });
  }}
/>
```

## 5. Connect the backend

Add adapters as you need features:

| You want | Add |
|---|---|
| `@` mentions | `people`, and `mentionScope` or `workspaceId` on the editor |
| Image, media and attachment uploads | `files`, and `imageScope` on the editor |
| The editor loads and saves the document itself | `documents`, and `source` on the editor |
| Several people editing at once | `collaboration` (plus `documents`) |
| Comment notifications and the unread dot | `threads` |
| Version history | `versions` |
| AI writing | `ai` |
| PDF and Word export | `exporter` |
| PDF import | `importer` |

The [adapters guide](adapters.md) describes each one, with an example.

## Notes for Next.js

- Every file the package ships starts with `"use client"`. A Server Component can render `LexicalEditor`, but
  `EditorProvider` and its adapters (which hold functions) belong in a Client Component, as above.
- Everything renders in the browser. On the server, editors render a loading placeholder and read-only views an
  empty line, because sanitising HTML needs the DOM. Don't rely on server-rendered document text, for SEO for
  example.
- The document editor, the comment composer, Yjs, the emoji data and KaTeX load on demand. A page that shows only
  read-only content doesn't download them.

## Next steps

- [Document editor](document-editor.md): saved documents, the header, comments, versions, import and export.
- [Comment composer](comment-composer.md): posting, replying and showing comments.
- [Live collaboration](collaboration.md): a y-websocket server and authorising its sockets.
