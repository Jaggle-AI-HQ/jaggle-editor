# Changelog

## 0.6.0

- The comments panel is laid out as Jaggle Office's (its paged documents, sheets, slides and PDFs), so comments look
  alike across Jaggle:
  - The title row's count is the open threads, with search (a field under the title) and close.
  - A New comment card: dashed until text is selected, then "Add a comment · On your selection", which opens the
    new comment's field at the top of the panel (with the text it is on still highlighted in the document). With the
    panel closed, the field still opens by the selected text.
  - All or For you (threads you wrote in or are @mentioned in), with the status beside it in a menu (Open, Resolved,
    All comments, with counts) that also holds the order (position, recent activity, oldest first).
  - Cards: the quote in the highlight's amber, a Resolved pill, and a chevron that folds a thread to one line. Each
    comment has its author, time, and a menu with Edit and Delete; the first also has Resolve (or Reopen). Replies
    sit under a rule. The picked thread gets a ring and the reply field; the others step back and offer "Reply".
  - Empty states say what to do next, with a way out of a filter or search, and an open list ends with "N resolved
    comments".

## 0.5.0

- The editor's header actions are in one order: version history, then comments, then ⋯. Their tooltips show
  their shortcuts, which now work anywhere on the page while the editor is open: ⌘⌥⇧H (Ctrl+Alt+Shift+H elsewhere)
  toggles version history and ⌘⌥⇧A toggles comments, as in Google Docs.
- Below tablet width (768px) the history and comments buttons fold into the ⋯ menu, with their shortcuts, so the
  title keeps its room. The ⋯ button carries the unread dot while comments are folded into it.
- `DocumentHandle.revealPerson(id)` scrolls to someone's cursor in the live room (an `id` from `onPresenceChange`),
  for apps whose avatars take you to the person. It returns `false` when they have no cursor in the document now.

## 0.4.0

- `onPresenceChange(people)` on the document editor reports who else is in the live room (`DocumentPresencePerson`:
  `id`, `name`, `color`, `avatarUrl`, `focusing`), one entry per person, from the room's awareness. Apps draw the
  avatars; Jaggle Office shows them beside Share in pageless documents.

## 0.3.0

- Fixed: the slash menu, and the mention menu where it stays in the editor, were squeezed to a few rows in a short
  document, because they were kept inside the editor's own box. They now stay within the editor's visible area: as
  tall as the part of the screen the document shows in (below the sticky header), and as wide as the editor.
- Clicking commented text opens the comments panel on its thread, which scrolls into view. A resolved thread picked
  this way switches the panel from Open to All.
- The comments and version history panels are redone and share one set of pieces (`components/side-panel.tsx`):
  - The panel is framed: a border on every side, rounded, inset 0.5rem from the editor's edge, sliding in when
    opened.
  - A title row with a count, and a segmented filter under it (comments: Open, Resolved, All; versions: All versions,
    Named, replacing the "Show autosaves" menu).
  - Empty states with an icon, and a button out of the filter or search that hides everything.
- Comment threads:
  - Cards on a tinted list. The picked thread gets a firmer neutral edge and its quote takes the highlight's amber.
  - Hovering a card lights up its text in the document (`.lexical-mark.hovered` in `styles.css`).
  - A resolved thread shows a Resolved pill, which reopens it.
  - Reactions take no room until a comment has one; the add-reaction button joins the comment's hover actions.
- Version history:
  - Autosaves in a row fold into one entry ("11 autosaves", the time span and who saved), which opens to one line
    per autosave. Named versions stand alone.
  - An autosave can be named from its menu ("Name this version").
  - Choosing Named while previewing an autosave goes back to the current version.

## 0.2.2

- Fixed: code blocks kept the colours of the mode they were highlighted in, because the Shiki theme and colours are
  stored on the nodes, in the shared document. A block highlighted in light mode and opened in dark mode was dark
  text on the dark card, and switching modes rewrote the theme of every block, so people in different modes in a
  live room overwrote each other's. New blocks are now always highlighted with `github-light`. When rendering, the
  editor gives each block both its `github-light` and `github-dark` colours, and `styles.css` shows the ones for the
  viewer's `.dark` class. Switching modes writes nothing. Blocks saved in dark mode by earlier versions keep
  `github-dark` and show correctly in light mode too. Apps on 0.2.1 or earlier in the same room still rewrite the
  theme when they switch modes.

## 0.2.1

- Fixed: a page that passes `source` inline (a new object each render) made the document editor reload its comment
  threads and read marker on every render. Against an app whose thread requests re-render the page, that never
  stopped. The editor now keys them on the document (`entityType`, `entityId`, `documentKey`), as jaggle-app-fe's
  editor did.

## 0.2.0

- MIT licensed (it was UNLICENSED), and the repository is public.
- The package is named `@jaggle-ai/editor`. GitHub Packages only takes the owner's scope, so it is published there as
  `@jaggle-ai-hq/editor`: install it under the alias `@jaggle-ai/editor@npm:@jaggle-ai-hq/editor@^0.2.0`. Publishing
  to npm as `@jaggle-ai/editor` is set up and needs the `NPM_TOKEN` secret.
- Each GitHub release carries the package as `jaggle-ai-editor-<version>.tgz`, which installs from its URL with no
  token.
- The editor's query keys now start with `"@jaggle-ai/editor"` (`EDITOR_QUERY_KEY`).
- The code is otherwise the same as 0.1.1.

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
