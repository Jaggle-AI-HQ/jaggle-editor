"use client";

import { HugeiconsIcon } from "@hugeicons/react";

import { useEditorAdapters, useNotify } from "../../adapters/context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import type { DocumentExportType } from "../../lib/document-transfer";

import { useTranslation } from "../lib/locale";

import { IncompleteDocumentNotice } from "./incomplete-document-notice";
import { useExportFormats } from "./shell-actions";

/**
 * Export for a saved document shown without the editor (a read-only page or
 * a list): the same formats and output as the editor's Export menu.
 */
export function DocumentExportDialog({
  open,
  onOpenChange,
  html,
  title,
  loading = false,
  incomplete = false,
  onRetry,
  retrying = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The document's saved HTML (`editor-state` content). */
  html: string;
  title?: string;
  /** The saved document is still loading: nothing to export yet. */
  loading?: boolean;
  /**
   * `html` is only part of the document (`content_truncated`): exporting it
   * would produce a file missing content, so the formats stay off.
   */
  incomplete?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  const { files, exporter } = useEditorAdapters();
  const toast = useNotify();
  const exportFormats = useExportFormats();
  const unavailable = loading || incomplete;

  const exportAs = (format: DocumentExportType, label: string) => {
    onOpenChange(false);
    // The export pipeline (every document node) loads only when used.
    const run = import("../document/headless").then(({ exportDocumentHtml }) =>
      exportDocumentHtml(html, format, title, { files, exporter }),
    );
    toast.promise(run, {
      loading: t.exportPreparing.replace("{format}", label),
      success: t.exportDone.replace("{format}", label),
      error: (error: unknown) => (error instanceof Error ? error.message : t.exportFailed),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.exportFile}</DialogTitle>
          <DialogDescription>{title || t.exportAs}</DialogDescription>
        </DialogHeader>
        {incomplete && onRetry ? (
          <IncompleteDocumentNotice purpose="export" onRetry={onRetry} retrying={retrying} />
        ) : null}
        <div className="grid grid-cols-2 gap-2" aria-busy={loading}>
          {exportFormats.map(({ format, label, icon }) => (
            <button
              key={format}
              type="button"
              disabled={unavailable}
              onClick={() => exportAs(format, t[label])}
              className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-start transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HugeiconsIcon icon={icon} size={18} aria-hidden="true" className="text-muted-foreground" />
              {t[label]}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
