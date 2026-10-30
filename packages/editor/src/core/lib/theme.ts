import type { EditorThemeClasses } from "lexical";

export const editorTheme: EditorThemeClasses = {
  root: "relative outline-none",
  autocomplete: "text-muted-foreground select-none",
  characterLimit: "inline bg-destructive/10 text-destructive",
  ltr: "text-left",
  rtl: "text-right",
  paragraph: "relative m-0 mb-2 last:mb-0",
  heading: {
    h1: "relative mt-6 mb-4 scroll-m-20 text-4xl font-extrabold tracking-tight text-balance first:mt-0 last:mb-0",
    h2: "relative mt-6 mb-3 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0",
    h3: "relative mt-4 mb-2 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0",
    h4: "relative mt-4 mb-2 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0",
    h5: "relative mt-3 mb-2 scroll-m-20 text-lg font-semibold tracking-tight first:mt-0 last:mb-0",
    h6: "relative mt-3 mb-2 scroll-m-20 text-base font-semibold tracking-tight first:mt-0 last:mb-0",
  },
  quote:
    "relative my-4 border-s-2 ps-6 text-muted-foreground italic first:mt-0 last:mb-0",
  list: {
    checklist: "!ps-1",
    listitem: "relative",
    listitemChecked:
      "relative list-none ps-[24px] text-muted-foreground outline-none before:absolute before:start-0 before:top-[3px] before:size-[16px] before:cursor-pointer before:rounded-[4px] before:border before:border-foreground before:bg-foreground before:shadow-xs after:absolute after:start-[5px] after:top-[6px] after:h-[9px] after:w-[5px] after:rotate-45 after:cursor-pointer after:border-r-2 after:border-b-2 after:border-background focus:before:ring-2 focus:before:ring-ring/50",
    listitemUnchecked:
      "relative list-none ps-[24px] outline-none before:absolute before:start-0 before:top-[3px] before:size-[16px] before:cursor-pointer before:rounded-[4px] before:border before:border-input before:shadow-xs focus:before:ring-2 focus:before:ring-ring/50 dark:before:bg-input/30",
    nested: {
      listitem: "list-none before:hidden after:hidden",
    },
    ol: "m-0 mb-2 ps-6 last:mb-0",
    olDepth: [
      "list-decimal",
      "list-[upper-alpha]",
      "list-[lower-alpha]",
      "list-[upper-roman]",
      "list-[lower-roman]",
    ],
    ul: "m-0 mb-2 ps-6 last:mb-0",
    ulDepth: ["list-disc", "list-[circle]", "list-[square]"],
  },
  indent: "lexical-indent",
  link: "cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80",
  hashtag: "rounded bg-primary/10 px-0.5 text-primary",
  mark: "lexical-mark",
  markOverlap: "lexical-mark-overlap",
  specialText:
    "rounded bg-yellow-200/70 px-1 font-semibold dark:bg-yellow-500/30",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "[text-decoration-line:underline_line-through]",
    code: "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
    subscript: "align-sub text-xs",
    superscript: "align-super text-xs",
    highlight: "rounded bg-yellow-200/70 dark:bg-yellow-500/30",
    lowercase: "lowercase",
    uppercase: "uppercase",
    capitalize: "capitalize",
  },
  code: "lexical-code relative mb-3 block overflow-x-auto rounded-lg border bg-card py-3 pe-4 ps-0 font-mono text-[13px] leading-relaxed [tab-size:2] [white-space:pre]",
  card: "lexical-card relative my-3 grid w-full gap-0.5 rounded-lg border bg-card px-2.5 py-2 text-start text-card-foreground transition-[color,box-shadow] first:mt-0 last:mb-0 data-[current-slot]:border-ring data-[selected=true]:border-primary data-[selected=true]:ring-2 data-[selected=true]:ring-primary/30",
  collapsibleContainer:
    "lexical-collapsible my-2 w-full rounded-lg border bg-card text-card-foreground first:mt-0 last:mb-0",
  collapsibleTitle:
    "relative block cursor-pointer list-none rounded-lg py-2 pe-3 ps-8 text-start font-medium outline-none select-none hover:underline",
  collapsibleContent: "pt-0 pe-3 pb-2 ps-8",
  pullQuote:
    "lexical-pullquote relative my-4 flex flex-col gap-2 rounded-md border-s-4 border-primary bg-muted/50 px-5 py-4 transition-[color,box-shadow] first:mt-0 last:mb-0 data-[selected=true]:ring-2 data-[selected=true]:ring-primary/40",
  review:
    "lexical-review relative my-3 rounded-lg border bg-card px-4 py-3 text-card-foreground first:mt-0 last:mb-0",
  codeHighlight: {
    inserted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    deleted: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  image: "inline-block w-full max-w-full",
  embedBlock: {
    // Wider than the 4 px caption gap, so a caption reads as part of its block.
    base: "relative my-5 select-none",
    focus: "rounded-md outline-2 outline-offset-2 outline-primary",
  },
  hr: "mx-0 my-6 h-0 border-0 border-t border-border",
  hrSelected: "rounded-full outline-2 outline-offset-4 outline-primary",
  layoutContainer: "lexical-layout-container my-3 grid gap-4",
  layoutItem:
    "lexical-layout-item min-w-0 rounded-md border border-dashed border-border p-2",
  tableScrollableWrapper:
    "lexical-table-scrollable-wrapper relative my-3 w-full overflow-x-auto",
  table: "w-max min-w-full table-fixed caption-bottom text-sm",
  tableRow: "border-b transition-colors hover:bg-muted/50",
  tableCell:
    "lexical-table-cell relative border p-2 text-start align-middle outline-none",
  tableCellHeader: "bg-muted/50 text-start font-medium",
  tableCellSelected: "lexical-table-cell-selected",
  tableSelected: "lexical-table-selected",
  tableSelection: "lexical-table-selection",
  tableAlignment: {
    center: "mx-auto",
    right: "ms-auto",
  },
};

export const documentTheme = editorTheme;

export const commentTheme = editorTheme;
