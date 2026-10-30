"use client";

import type { ReactNode } from "react";

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

function ShellButton({
  label,
  pressed,
  unseen = false,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  /** Something new since the panel was last open; shown as a dot, not a count. */
  unseen?: boolean;
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
            "relative size-7",
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
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Page actions pinned to the editor's top-end corner, like Notion's page
 * actions: no header bar, just quiet icons that stay reachable while the
 * document scrolls. Import and export sit behind the overflow menu.
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

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5",
        floating && "rounded-lg bg-background/80 p-0.5 backdrop-blur-sm",
      )}
    >
      {showComments ? (
        <ShellButton
          label={t.comments}
          pressed={commentsOpen}
          unseen={commentsUnseen}
          onClick={onToggleComments}
        >
          <MessageSquare className="size-4" />
        </ShellButton>
      ) : null}
      {showVersionHistory ? (
        <ShellButton
          label={t.versionHistory}
          pressed={versionsOpen}
          unseen={versionsUnseen}
          onClick={onToggleVersions}
        >
          <History className="size-4" />
        </ShellButton>
      ) : null}
      {showImport || showExport ? (
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t.moreActions}
                  className="size-7 text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.moreActions}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
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
