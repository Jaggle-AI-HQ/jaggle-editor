# Styling

The editor is styled with Tailwind CSS 4 classes and the standard shadcn/ui theme variables. It doesn't ship a
compiled copy of Tailwind. The app's own Tailwind build generates the classes the editor uses, so the editor
follows the app's theme.

## Setup

In the app's main stylesheet, after `@import "tailwindcss"`:

```css
@import "tailwindcss";
@import "tw-animate-css"; /* the editor's menus and dialogs animate with it */
@import "@jaggle-ai-hq/editor/styles.css";
@source "../node_modules/@jaggle-ai-hq/editor/dist";

@custom-variant dark (&:is(.dark *));
```

- **`@import "@jaggle-ai-hq/editor/styles.css"`** adds the CSS that utility classes can't express. That covers the
  block handle menu, placeholders, comment highlights, find-and-replace matches, code blocks, tables, cards,
  toggles, pull quotes, and KaTeX for equations. It's plain CSS, so import it from CSS, never from TypeScript.
- **`@source`** tells Tailwind to scan the package's built files for class names. Without it, the editor renders
  unstyled. The path is relative to this CSS file:

  | Layout | `@source` |
  |---|---|
  | CSS in `src/`, `node_modules` beside `src/` | `"../node_modules/@jaggle-ai-hq/editor/dist"` |
  | CSS in `src/app/` (Next.js App Router) | `"../../node_modules/@jaggle-ai-hq/editor/dist"` |
  | A workspace app with `node_modules` hoisted to the repo root | e.g. `"../../../node_modules/@jaggle-ai-hq/editor/dist"` |

- **`tw-animate-css`** provides the `animate-in` and `fade-in` classes that menus and dialogs use. Install it in the
  app (`npm install tw-animate-css`).

## Theme variables

The editor reads these shadcn/ui variables, so the app must define them:

| Variable | Used for |
|---|---|
| `--background`, `--foreground` | The writing surface and its text |
| `--card`, `--card-foreground` | Cards (boards, embeds) |
| `--popover`, `--popover-foreground` | Menus, toolbars, hover cards |
| `--primary`, `--primary-foreground` | Buttons, links, the selection accent |
| `--secondary`, `--secondary-foreground` | Secondary buttons |
| `--muted`, `--muted-foreground` | Placeholders, hints, quiet surfaces |
| `--accent`, `--accent-foreground` | Hover and active states |
| `--destructive` | Delete actions, errors |
| `--border`, `--input`, `--ring` | Borders, inputs, focus rings |
| `--radius` | Corner radius |

They must also be mapped to Tailwind colours, as shadcn/ui's setup does:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

The playground's [`index.css`](../../../apps/playground/src/index.css) is a complete example, with jaggle-app-fe's
colours for light and dark.

## Dark mode

The editor follows a `.dark` class on any ancestor (usually `<html>`), through the `dark` variant above. Define the
dark values of the variables under `.dark`, as shadcn/ui does. The editor has no theme prop.

## Fonts and sizes

The editor inherits the page's font family. Text sizes are Tailwind's (`text-base` for documents, `text-sm` for
comments), so they follow the root font size.

## Layout

- **Document editor:** it fills its container (`h-full`, a flex column) and scrolls inside it. Give the container a
  height, for example `flex h-[calc(100vh-4rem)] flex-col`. With `page`, content sits in a centred column up to
  `max-w-4xl`. The comments and versions sidebars are 20rem wide and stick below the header.
- **Block handles** (`sideMenu`, on by default) sit to the left of the content. Without `page`, the editor reserves
  room for them on the left.
- **Comment composer:** a rounded box with a small margin. `containerClassName` adds classes to it (to remove the
  margin, say).
- **Read-only views** take the width of their container.

## Reduced motion and high contrast

Under `prefers-reduced-motion: reduce`, the block handle menu appears without its fade. In forced-colours mode
(Windows high contrast), find-and-replace matches use the system highlight colours.
