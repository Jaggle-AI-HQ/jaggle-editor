"use client";

import type { ReactNode } from "react";

import { formatKeyboardShortcut } from "@lexical/extension";
import { CONTROL_OR_META, IS_APPLE, type KeyboardShortcutMatch } from "lexical";

import {
  Doc01Icon,
  HtmlFile01Icon,
  Pdf01Icon,
  Txt01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Download,
  History,
  MessageSquare,
  MoreHorizontal,
  Upload,
} from "lucide-react";

import { useEditorAdapters } from "../../adapters/context";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import type { DocumentExportType } from "../../lib/document-transfer";
import { cn } from "../../lib/utils";

import { type Locale, useTranslation } from "../lib/locale";

export const EXPORT_FORMATS: {
  format: DocumentExportType;
  label: keyof Locale;
  icon: IconSvgElement;
}[] = [
  { format: "pdf", label: "exportPdf", icon: Pdf01Icon },
  { format: "docx", label: "exportDocx", icon: Doc01Icon },
  { format: "html", label: "exportHtml", icon: HtmlFile01Icon },
  { format: "markdown", label: "exportMarkdown", icon: Txt01Icon },
];

/** PDF and Word need the app's `exporter`; HTML and Markdown are made here. */
export function useExportFormats() {
  const { exporter } = useEditorAdapters();
  return exporter
    ? EXPORT_FORMATS
    : EXPORT_FORMATS.filter(({ format }) => format === "html" || format === "markdown");
}

/**
 * The panels' shortcuts, as Google Docs (and Jaggle Office's other editors)
 * have them: ⌘⌥⇧H version history, ⌘⌥⇧A comments (Ctrl+Alt+Shift elsewhere).
 */
const PANEL_MODIFIERS = { ...CONTROL_OR_META, altKey: true, shiftKey: true };
export const PANEL_SHORTCUTS: Readonly<Record<"versions" | "comments", KeyboardShortcutMatch>> =
  Object.freeze({
    versions: { key: "h", modifiers: PANEL_MODIFIERS },
    comments: { key: "a", modifiers: PANEL_MODIFIERS },
  });

/**
 * Whether a key press is a panel shortcut. Matched on `code`: with Alt held a
 * Mac types another character for the key.
 */
export function matchesPanelShortcut(
  event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  shortcut: KeyboardShortcutMatch,
) {
  return (
    event.code === `Key${shortcut.key.toUpperCase()}` &&
    (IS_APPLE ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
    event.altKey &&
    event.shiftKey
  );
}

function shortcutText(shortcut: KeyboardShortcutMatch) {
  return formatKeyboardShortcut(shortcut).join(IS_APPLE ? "" : "+");
}

function ShellButton({
  label,
  pressed,
  unseen = false,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  /** Something new since the panel was last open; shown as a dot, not a count. */
  unseen?: boolean;
  /** Shown in the tooltip. */
  shortcut?: KeyboardShortcutMatch;
  onClick: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={unseen ? `${label} (${t.newActivity})` : label}
          aria-pressed={pressed}
          className={cn(
            // Narrow screens reach it from the ⋯ menu.
            "relative size-7 max-md:hidden",
            pressed
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground",
          )}
          onClick={onClick}
        >
          {children}
          {unseen && !pressed ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {unseen ? `${label} · ${t.newActivity}` : label}
        {shortcut ? <span className="ms-2 opacity-70">{shortcutText(shortcut)}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Page actions pinned to the editor's top-end corner, like Notion's page
 * actions: no header bar, just quiet icons that stay reachable while the
 * document scrolls. Version history comes first, then comments (the order
 * Jaggle Office's editors use); import and export sit behind the overflow
 * menu, which on narrow screens holds the two panels as well.
 */
export function ShellActions({
  showComments,
  showVersionHistory,
  showImport,
  showExport,
  commentsOpen,
  versionsOpen,
  commentsUnseen,
  versionsUnseen,
  onToggleComments,
  onToggleVersions,
  onImport,
  onExportAs,
  floating = false,
}: {
  /** Floating over the document corner (no header row) gets a soft backdrop. */
  floating?: boolean;
  showComments: boolean;
  showVersionHistory: boolean;
  showImport: boolean;
  showExport: boolean;
  commentsOpen: boolean;
  versionsOpen: boolean;
  commentsUnseen: boolean;
  versionsUnseen: boolean;
  onToggleComments: () => void;
  onToggleVersions: () => void;
  onImport: () => void;
  onExportAs: (format: DocumentExportType) => void;
}) {
  const { t } = useTranslation();
  const exportFormats = useExportFormats();

  if (!showComments && !showVersionHistory && !showImport && !showExport) {
    return null;
  }
  const panels = showComments || showVersionHistory;
  const transfer = showImport || showExport;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5",
        floating && "rounded-lg bg-background/80 p-0.5 backdrop-blur-sm",
      )}
    >
      {showVersionHistory ? (
        <ShellButton
          label={t.versionHistory}
          pressed={versionsOpen}
          unseen={versionsUnseen}
          shortcut={PANEL_SHORTCUTS.versions}
          onClick={onToggleVersions}
        >
          <History className="size-4" />
        </ShellButton>
      ) : null}
      {showComments ? (
        <ShellButton
          label={t.comments}
          pressed={commentsOpen}
          unseen={commentsUnseen}
          shortcut={PANEL_SHORTCUTS.comments}
          onClick={onToggleComments}
        >
          <MessageSquare className="size-4" />
        </ShellButton>
      ) : null}
      {panels || transfer ? (
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t.moreActions}
                  className={cn(
                    "relative size-7 text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                    // Only the panels inside: wide screens have their buttons.
                    !transfer && "md:hidden",
                  )}
                >
                  <MoreHorizontal className="size-4" />
                  {commentsUnseen || versionsUnseen ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-background md:hidden"
                    />
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.moreActions}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            {showVersionHistory ? (
              <DropdownMenuItem className="md:hidden" onSelect={onToggleVersions}>
                <History />
                {t.versionHistory}
                <span className="ms-auto text-xs text-muted-foreground">{shortcutText(PANEL_SHORTCUTS.versions)}</span>
              </DropdownMenuItem>
            ) : null}
            {showComments ? (
              <DropdownMenuItem className="md:hidden" onSelect={onToggleComments}>
                <MessageSquare />
                {t.comments}
                <span className="ms-auto text-xs text-muted-foreground">{shortcutText(PANEL_SHORTCUTS.comments)}</span>
              </DropdownMenuItem>
            ) : null}
            {panels && transfer ? <DropdownMenuSeparator className="md:hidden" /> : null}
            {showImport ? (
              <DropdownMenuItem onSelect={onImport}>
                <Upload />
                {t.importMenuItem}
              </DropdownMenuItem>
            ) : null}
            {showImport && showExport ? <DropdownMenuSeparator /> : null}
            {showExport ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download />
                  {t.exportFile}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {exportFormats.map(({ format, label, icon }) => (
                    <DropdownMenuItem key={format} onSelect={() => onExportAs(format)}>
                      <HugeiconsIcon icon={icon} size={16} aria-hidden="true" />
                      {t[label]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
