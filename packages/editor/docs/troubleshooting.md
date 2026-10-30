# Troubleshooting

## Installing

### `401 Unauthorized` or `404 Not Found` from `npm.pkg.github.com`

- The token needs the `read:packages` scope, and an account with access to the `Jaggle-AI-HQ` organisation.
- The `@jaggle-ai-hq` scope must point at GitHub Packages (`.npmrc` or `.yarnrc.yml`, see the
  [README](../README.md#install)). Without it, the package manager looks on npmjs.org and returns 404.
- In CI and Docker builds, pass the token as a secret (`GITHUB_PACKAGES_TOKEN`), not baked into an image layer.

### Yarn or pnpm refuses a new version

Both can hold back releases younger than a minimum age. Allow the scope: `npmPreapprovedPackages: ["@jaggle-ai-hq/*"]`
in `.yarnrc.yml`, or `minimumReleaseAgeExclude: ["@jaggle-ai-hq/*"]` in `pnpm-workspace.yaml`.

### Lexical or Yjs is loaded twice

Symptoms: "Yjs was already imported. This breaks constructor checks" in the console; live editing doesn't sync; or
Lexical errors about nodes or editors that don't exist.

- `lexical`, every `@lexical/*` package and `yjs` are peer dependencies. Install them once, in the app, with every
  `@lexical/*` package on the same `0.51.x` version as `lexical`.
- Check with `npm ls lexical yjs` (or `yarn why`, `pnpm why`). There should be one version of each.
- In a monorepo, make sure the app and any linked package resolve the same copies (Vite: `resolve.dedupe`).

## Rendering

### The editor looks unstyled, or menus are transparent

- Tailwind isn't generating the editor's classes. Add `@source` for the package's `dist` folder, with the right
  relative path from your CSS file ([Styling](styling.md#setup)).
- `@import "@jaggle-ai-hq/editor/styles.css"` is missing.
- The shadcn/ui variables (`--popover`, `--border`…) aren't defined or aren't mapped in `@theme`.
- Menus and dialogs don't animate: install and import `tw-animate-css`.

### "No QueryClient set, use QueryClientProvider to set one"

Put a TanStack Query `QueryClientProvider` above the editors. The app's existing one works.

### Next.js: "Functions cannot be passed directly to Client Components"

Adapters hold functions, so they can't cross from a Server Component. Build them, and render `EditorProvider`, in a
Client Component (`"use client"`), as in [Getting started](getting-started.md#3-wrap-the-app-in-the-providers).

### The document editor has no height, or doesn't scroll

It fills its container (`h-full`). Give the container a height and make it a flex column:
`<div className="flex h-[70vh] flex-col">`.

## Saved documents

### The document stays on its loading state

- `currentUser` is still `null`. A saved document waits for it.
- `documents.load` hasn't resolved. A rejection shows a notice with Retry.
- `load` returned `incomplete: true` without a `yjsState`. The editor won't open a partial copy.

### Nothing saves

- Use `onSaveStatusChange` to see what happens. `"error"` means `documents.save` rejected, and the editor retries
  with the next edit.
- Only local edits save. Content arriving from the live room, or loaded at open, doesn't.
- `conflictMessage` returning a message for every error makes the editor stop saving after the first failure.
  Return `null` for anything but a refused save.

### "This document changed elsewhere" right after opening

The backend refused a save that it should have accepted. Check that:
- `documents.load` returns the stored `revision`;
- `documents.save` accepts a save at the stored revision (the editor sends the revision it loaded, or a later one
  that a save returned);
- `documents.save` returns the revision it stored, and doesn't bump it for editor saves.

See [Revisions](document-editor.md#revisions).

### Two people don't see each other's edits

- Is the `collaboration` adapter set, with a `ws://` or `wss://` URL the browser can reach? If the server can't be
  reached, the document opens after 4 seconds and saves still work, so it can look like it's working.
- Do both open the same room? The room is `` `${roomId}:lexical:r${revision}` ``, so `source.roomId` and the loaded
  revision must match.
- Does the server accept the socket? Check its origin and authorisation rules, and the browser's network tab for the
  WebSocket's status.
- Is Yjs loaded once? See [above](#lexical-or-yjs-is-loaded-twice).

## Features

### `@` lists nobody

- The `people` adapter is missing.
- A comment composer needs `mentionScope`. It doesn't fall back to `workspaceId`.
- A document editor needs `mentionScope` or `workspaceId`.
- `people.search` must return everyone for an empty `search` (the list opens before anything is typed).

### Uploaded images disappear after a reload

The upload stayed in the page: the editor has no `imageScope`, or there's no `files` adapter. Both are needed to
upload.

### Images break after a while

Don't store URLs. The editor stores `jaggle-file://attachment/<id>`, and `files.resolveUrl` should return a fresh
URL (a new signed URL, say) whenever it's called.

### A button or menu is missing

| Missing | Needs |
|---|---|
| Version history | `showVersionHistory`, a `source`, and the `versions` adapter |
| AI writing | The `ai` adapter |
| PDF and Word in Export | `showExport` and the `exporter` adapter |
| PDF import ("PDF import is available once the document is saved") | `showImport`, the `importer` adapter and `imageScope` |
| Comments | `showComments` |
| Block handles | `sideMenu` isn't `false` |

### Errors only show in the console

Pass a `notify` adapter, for example sonner's `toast`. Without one, notices go to the console.
