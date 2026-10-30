# @jaggle-ai-hq/editor guides

The [package README](../README.md) covers installing, styles and the contracts shared between apps. These guides
explain how to use the editor in an app.

| Guide | Read it when you want to |
|---|---|
| [Getting started](getting-started.md) | Add the editor to a React app for the first time |
| [Document editor](document-editor.md) | Edit page-sized content: local content, saved documents, read-only views, the header, `onReady` |
| [Comment composer](comment-composer.md) | Add a comment box and show posted comments |
| [Adapters](adapters.md) | Connect the editor to your backend: every adapter, with an example |
| [Live collaboration](collaboration.md) | Edit a document together through a y-websocket server |
| [Styling](styling.md) | Set up Tailwind, theme variables, dark mode and layout |
| [Headless and kit](headless-and-kit.md) | Convert or export content without an editor, or build a small editor of your own |
| [Troubleshooting](troubleshooting.md) | Fix an editor that misbehaves: missing styles, no saves, no mentions… |

The [playground](../../../apps/playground) runs every feature against in-memory adapters (`npm run playground`).
Its `src/adapters.ts` is a complete set of adapters you can copy from.
