# @jaggle-ai/editor

Jaggle's rich-text editor, built on [Lexical](https://lexical.dev) 0.51, for React 19 apps. It has two modes:

- **Document editor**: slash menu, Markdown shortcuts, tables, boards, polls, equations, media and embeds. Optionally it also has live collaboration, comment threads, version history, AI writing, and import/export.
- **Comment composer**: mentions, emoji, and one attachment.

It was extracted from jaggle-app-fe (see `CHANGELOG.md`) so that Jaggle AI and Jaggle Office share one editor. Anything that talks to a backend goes through **adapters** the app provides.

## Guides

This README is the reference for installing and for the contracts between apps. The [guides](docs/README.md) explain how to use the editor:

- [Getting started](docs/getting-started.md): from install to a working editor
- [Document editor](docs/document-editor.md): local content, saved documents, read-only views, the header, `onReady`, comments, versions, import and export
- [Comment composer](docs/comment-composer.md): posting, editing, replying, attachments
- [Adapters](docs/adapters.md): every adapter, with an example implementation
- [Live collaboration](docs/collaboration.md): the y-websocket server, rooms, presence, authorising sockets
- [Styling](docs/styling.md): Tailwind setup, theme variables, dark mode, layout
- [Headless and kit](docs/headless-and-kit.md): converting and exporting without an editor, building your own small editor
- [Troubleshooting](docs/troubleshooting.md)

## Install

The package is MIT licensed, and its name is `@jaggle-ai/editor`. Until it's on npm (the Publish workflow's `npm` registry, which needs the repository's `NPM_TOKEN` secret), install it from GitHub in one of two ways.

**From a GitHub release (no token, recommended for now).** Every release carries the package as `jaggle-ai-editor-<version>.tgz`. The repository is public, so it downloads without a token or any registry setup, in CI and Docker builds too:

```bash
yarn add "@jaggle-ai/editor@https://github.com/Jaggle-AI-HQ/jaggle-editor/releases/download/%40jaggle-ai-hq/editor%400.2.0/jaggle-ai-editor-0.2.0.tgz"
```

To upgrade, change the version (twice) in the URL. The release tag is `@jaggle-ai-hq/editor@<version>`, URL-encoded.

**From GitHub Packages.** GitHub Packages only takes the repository owner's scope, so the package is published there as `@jaggle-ai-hq/editor`. Install it under its real name with an alias, so imports already say `@jaggle-ai/editor` and moving to npm later only changes the dependency:

```bash
yarn add @jaggle-ai/editor@npm:@jaggle-ai-hq/editor@^0.2.0
```

Installing from GitHub Packages needs a token with `read:packages`: a personal token locally, a CI secret in pipelines and Docker builds. It needs one even though the repository is public.

- **Yarn 4 (jaggle-app-fe)**, in `.yarnrc.yml`:

  ```yaml
  npmScopes:
    jaggle-ai-hq:
      npmRegistryServer: "https://npm.pkg.github.com"
      npmAlwaysAuth: true
      npmAuthToken: "${GITHUB_PACKAGES_TOKEN-}"
  # Our releases are newer than the 7-day age gate.
  npmPreapprovedPackages:
    - "@jaggle-ai/*"
    - "@jaggle-ai-hq/*"
  ```

- **pnpm / npm (Jaggle Office)**, in `.npmrc`:

  ```ini
  @jaggle-ai-hq:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
  ```

  With pnpm, also add `@jaggle-ai-hq/*` and `@jaggle-ai/*` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

**From npm (once published).** Install `@jaggle-ai/editor` itself and drop the GitHub Packages settings. No token is needed.

**Peer dependencies.** Install these once, in the app, because there must be a single copy of each:

```bash
yarn add @tanstack/react-query yjs lexical @lexical/clipboard @lexical/code @lexical/code-shiki @lexical/extension @lexical/history @lexical/html @lexical/link @lexical/list @lexical/mark @lexical/markdown @lexical/react @lexical/rich-text @lexical/selection @lexical/table @lexical/text @lexical/utils @lexical/yjs
```

The version ranges:
- React `^19.2`
- TanStack Query `^5`
- Yjs `^13.6`
- `lexical` and every `@lexical/*` package at `~0.51.0`, all on the same version

## Styles

The editor is styled with Tailwind 4 classes and the standard shadcn/ui theme variables. Your app's Tailwind build generates those classes. In the app's main stylesheet, after `@import "tailwindcss"`:

```css
@import "tw-animate-css"; /* menus and dialogs animate with it */
@import "@jaggle-ai/editor/styles.css";
@source "../node_modules/@jaggle-ai/editor/dist"; /* path from this CSS file */
```

The app must define these shadcn variables: `--background`, `--foreground`, `--card(-foreground)`, `--popover(-foreground)`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`. They must also be mapped to colours in `@theme`.

Dark mode follows a `.dark` class on an ancestor (`@custom-variant dark (&:is(.dark *))`).

## Use

```tsx
import { EditorProvider, LexicalEditor, type EditorAdapters } from "@jaggle-ai/editor";

function Editors({ children }: { children: React.ReactNode }) {
  const adapters = useMemo<EditorAdapters>(() => ({ currentUser, people, files, documents /* … */ }), [/* … */]);
  // A TanStack Query QueryClientProvider must be above this.
  return <EditorProvider adapters={adapters}>{children}</EditorProvider>;
}

// A saved, collaborative document (a task's description):
<LexicalEditor
  mode="document"
  source={{ entityType: "task", entityId: task.id, roomId: `${workspaceId}:task-${task.id}` }}
  workspaceId={workspaceId}
  mentionScope={{ type: "project", id: projectId }}
  imageScope={{ entityType: "task", entityId: task.id }}
  showComments
  showVersionHistory
  showExport
/>

// A comment box:
<LexicalEditor mode="comment" onComment={(state, html, text) => post({ state, html, text })} />

// Read-only HTML (no editor is loaded):
<LexicalEditor mode="document" readOnly html={savedHtml} />
```

The document editor and comment composer load on demand, along with Yjs, the emoji data and KaTeX. A page that only shows `readOnly` HTML doesn't load them.

Every prop is documented on `LexicalEditorProps`. Two props are required where they apply, because there is no route to infer them from:
- `mentionScope` for mentions. A document editor falls back to `workspaceId`; a comment composer doesn't.
- `imageScope` for uploads

## Adapters

`EditorAdapters` (see `src/adapters/types.ts`) is everything the editor asks of the app. Pass a stable object (`useMemo`).

| Adapter | What the editor uses it for | Without it |
|---|---|---|
| `currentUser` (required, `null` while loading) | Comment author, live cursor, version author | Saved documents wait for it |
| `people` | `@` mentions, the mention hover card, board assignees | No mentions |
| `files` | Uploads (images, media, comment attachments), turning `jaggle-file://` references into URLs, lasting links in posted comments, an optional full-size `FileViewer` | Files stay in the page as local URLs (previews only); attachments open in a new tab |
| `documents` | Loading and saving a `source` document (its Y.Doc plus HTML); `conflictMessage` recognises a refused save | A `source` throws |
| `threads` | Mirrors comment threads to the app (to notify mentions), loads threads written elsewhere, and the read marker for the unread dot | Comments still work: they live in the document's Y.Doc |
| `versions` | Version history: list, preview, named saves, automatic versions, restore | No version history |
| `ai` | AI writing (`stream`), plus optional `credits` (shortfall hook, usage link, badge) | No AI menu or "Ask AI" |
| `exporter` | PDF and Word export (renders a complete HTML document) | Only HTML and Markdown export |
| `importer` | PDF import | Word, HTML and Markdown import still work |
| `collaboration` | The y-websocket server `url`, and `webSocketFor(room)` (a `WebSocketPolyfill`, e.g. one that sends an auth ticket) | The document is edited alone (still saved) |
| `notify` | Notices. Takes sonner's `toast` as-is | `console` |
| `onSaveConflict` | "Reload" after a refused save | `window.location.reload()` |

### Contracts shared between apps

Both apps open the same documents, so these must not change:

**Live room**
- Room name: `` `${source.roomId}:lexical:r${revision}` ``. `revision` moves when the document is written outside the editor; that sends everyone to a new room seeded from the new content.

**Y.Doc**
- Root XmlText `"main"` holds the content.
- `Y.Map "lexical-document-meta"` holds the saved `revision`.
- `Y.Map "lexical-comment-threads"` holds the comment threads.

**Files**
- Uploads are stored in content as `jaggle-file://attachment/<attachmentId>`, never as URLs.

**Comments**
- `onComment` and comment threads carry `CommentBody` (`{ format: "lexical", state, html, text }`).

## Other entry points

- `@jaggle-ai/editor/headless`:
  - `documentHtmlFromMarkdown`, for AI output saved without opening an editor
  - `exportDocumentHtml(html, format, title, { files, exporter })`
  - `createHeadlessDocumentEditor`
- `@jaggle-ai/editor/kit`: building blocks for a small editor of your own (jaggle-app-fe's sticky notes):
  - `EditorErrorBoundary`, `ToolbarToggle`, `ToolbarIconButton`
  - `$getActiveTextFormats`
  - the themes and comment payload helpers

## From jaggle-app-fe's services to adapters

When jaggle-app-fe switches to this package, its adapters map onto the services the editor used to call. These lived in `src/components/lexical/core`:

| Adapter | jaggle-app-fe today |
|---|---|
| `currentUser` | `useCurrentUser()`; name from `getUserFullName`, `avatar_url` |
| `people.search` | `useUsersInProject` / `useUsersInWorkspace` (`statuses: ["active"]` for workspaces) |
| `people.get` | `useUserById(workspaceId, id)` |
| `files.upload` | `POST /files/upload` with `entity_type`, `entity_id`, `field_name`; returns `attachment_id ?? id`, `signed_url ?? url` |
| `files.resolveUrl` | `resolveInlineFileUrl` |
| `files.rawUrl` | `fetchFileAttachment(id)` → `getFileRawUrl(file.id)` |
| `files.FileViewer` | `FileViewerDialog` |
| `documents.load` | `queryClient.fetchQuery(editorStateQueryOptions(identity))` (keeps the task page's prefetch) → `{ yjsState: yjs_state, html: content, revision, incomplete: content_truncated }` |
| `documents.save` | `saveLexicalEditorState` with `content_format: "html"`, `state_format: "lexical"`, then `setEditorStateQueryData` |
| `documents.conflictMessage` | `editorStateConflictMessage` |
| `threads.*` | `document-thread-api` (rename `initialComment` → `initial_comment`, `mentionedUserIds` → `mentioned_user_ids`) |
| `versions.*` | `version-api` (`created_by.name` or the author's full name; `snapshot_state`, `content`, `state_format`) |
| `ai.stream` | `streamDocumentAi` (invalidate credits in `onCredits`) |
| `ai.credits` | `useGetCreditBalance` + `useGetFeatureWeights` for `"document-ai"`, `/w/${ws}/subscription/ai-billings`, `AICreditBadge` |
| `exporter.render` | `exportHtmlDocument` (`/api/export/pdf\|docx`) |
| `importer.pdfToHtml` | `importPdfAsHtml(file, pdfImportEntityKey(scope.entityId), …)` |
| `collaboration` | `NEXT_PUBLIC_YJS_WS_URL`; `webSocketFor: (room) => createTicketedWebSocket(() => requestYjsTicket(room))` |
| `notify` | sonner's `toast` |

## Develop

From the repo root, on Node 24:

```bash
npm install
npm run check          # build, lint, typecheck, test
npm run dev            # rebuild on change
npm run playground     # http://localhost:5190, in-memory adapters
npm run collab-server  # y-websocket on :1234, for ?collab=1 in the playground
```

The playground has a few URL parameters:
- `?user=grace` picks who you are
- `?collab=1` joins the live room; open two tabs as different people
- `?theme=dark` switches to dark mode
- `?tab=comments` opens a tab directly

## Publish

Run the **Publish Package** workflow (Actions → Publish Package) with a registry and a version bump:
- `github`: GitHub Packages, as `@jaggle-ai-hq/editor`, with the workflow's own token
- `npm`: npm, publicly, as `@jaggle-ai/editor`, with the repository's `NPM_TOKEN` secret

It does the following:
- runs the checks
- publishes a copy of the package under that registry's name (the repository keeps `@jaggle-ai/editor`)
- commits the version
- tags the published name and version, e.g. `@jaggle-ai-hq/editor@x.y.z`
- creates a GitHub release carrying `jaggle-ai-editor-<version>.tgz`, which installs from its URL with no token
