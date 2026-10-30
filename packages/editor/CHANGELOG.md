# Changelog

## 0.2.0

Published publicly on npm as `@jaggle-ai/editor`, under the MIT license. The code is the same as 0.1.1, which was
published privately as `@jaggle-ai-hq/editor` on GitHub Packages. Switch the dependency's name; nothing else changes.

- The editor's query keys now start with `"@jaggle-ai/editor"` (`EDITOR_QUERY_KEY`).

## 0.1.1

First version. The source is jaggle-app-fe's `src/components/lexical/core`, taken at `origin/dev` `ac0f887caddaba50a02b17afa94d7c3ebca3beed` (2026-10-30). Editor changes made in jaggle-app-fe after that commit need porting here until jaggle-app-fe uses this package.

Changes from jaggle-app-fe:

- **Adapters.** Every backend call goes through `EditorProvider` adapters instead of jaggle-app-fe's services:
  - editor state
  - threads
  - versions
  - files and uploads
  - people
  - AI and credits
  - export and PDF import
  - Yjs server
  - toasts

  A missing adapter hides its feature. Comments still work without `threads`, and files stay local without `files`.
- **No Next.js.**
  - `next/dynamic` became `React.lazy`.
  - `next/image` became `<img>`.
  - The `useParams` fallbacks for mention scope are gone: pass `mentionScope` or `workspaceId`.
  - `publicEnv` became `collaboration.url`. The hard-coded dev server fallback is gone.
- **Collaboration.**
  - The socket can carry an auth ticket (`collaboration.webSocketFor`).
  - Without a server, a document is edited and saved alone.
  - Fixed: React StrictMode's simulated unmount could destroy the live provider before Lexical reconnected it. Edits then neither synced nor saved.
- **Styles.** One `styles.css` (the editor CSS plus KaTeX), imported by the app. The UI parts use only standard shadcn variables. jaggle-app-fe's `text-body` became `text-base`, and `text-caption` became `text-[0.857rem]/[1.4]` (same sizes).
- **UI parts.** Its own copies of 21 shadcn/Radix components (`src/ui`, not exported).
- **Dead code removed.**
  - the fixed-toolbar plugins
  - the unused block-insert plugins
  - `image-button`
  - `searchMentions` (only its types remain)
- **Version history.** Shows only for saved documents with a `versions` adapter. It no longer shows sample versions.
