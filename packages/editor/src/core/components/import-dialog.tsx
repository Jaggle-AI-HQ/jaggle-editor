"use client";

import { type DragEvent, useEffect, useRef, useState } from "react";

import {
  AlertCircleIcon,
  Doc01Icon,
  FileImportIcon,
  HtmlFile01Icon,
  Pdf01Icon,
  Txt01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { UNDO_COMMAND } from "lexical";

import { useNotify } from "../../adapters/context";
import { Loader } from "../../ui/loader";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  ALL_IMPORT_ACCEPT,
  detectImportType,
  type DocumentImportType,
  MAX_PDF_PAGES,
  MAX_PDF_SIZE_MB,
  pdfSizeError,
  UNSUPPORTED_IMPORT_MESSAGE,
} from "../../lib/document-transfer";
import { cn } from "../../lib/utils";

import type { DocumentTransfer, ImportStep } from "../document/use-document-transfer";
import { type Locale, useTranslation } from "../lib/locale";

type Phase =
  | { kind: "pick"; error?: string }
  | { kind: "confirm"; file: File }
  | { kind: "working"; file: File; step: ImportStep }
  /** `retry` is off when retrying the same file cannot help (a size check). */
  | { kind: "error"; file: File; message: string; retry: boolean };

const TYPE_DETAILS: Record<DocumentImportType, { icon: IconSvgElement; label: keyof Locale }> = {
  pdf: { icon: Pdf01Icon, label: "importTypePdf" },
  docx: { icon: Doc01Icon, label: "importTypeDocx" },
  html: { icon: HtmlFile01Icon, label: "importTypeHtml" },
  markdown: { icon: Txt01Icon, label: "importTypeMarkdown" },
};

const STEP_LABELS: Record<ImportStep, keyof Locale> = {
  reading: "importStepReading",
  converting: "importStepConverting",
  "uploading-images": "importStepImages",
  "uploading-pdf": "importStepUploadingPdf",
  "processing-pdf": "importStepProcessingPdf",
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function FileRow({ file, busy = false }: { file: File; busy?: boolean }) {
  const { t } = useTranslation();
  const type = detectImportType(file) ?? "html";
  const details = TYPE_DETAILS[type];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <HugeiconsIcon icon={details.icon} size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" title={file.name}>
          {file.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {t[details.label]} · {formatSize(file.size)}
        </span>
      </span>
      {busy ? <Loader className="shrink-0 text-[6px]" /> : null}
    </div>
  );
}

/**
 * Replaces the document with a PDF, Word, HTML, or Markdown file. A file
 * dropped or chosen goes straight in on an empty document; otherwise the
 * replacement is confirmed first. One undo restores the previous content.
 */
export function ImportDialog({
  open,
  onOpenChange,
  transfer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: DocumentTransfer;
}) {
  const { t } = useTranslation();
  const toast = useNotify();
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "working", file, step: "reading" });
    try {
      await transfer.importFile(file, {
        signal: controller.signal,
        onStep: (step) => {
          if (!controller.signal.aborted) {
            setPhase({ kind: "working", file, step });
          }
        },
      });
      if (controller.signal.aborted) {
        return;
      }
      onOpenChange(false);
      toast.success(`${t.importDone} ${file.name}`, {
        action: {
          label: t.undo,
          onClick: () => editor.dispatchCommand(UNDO_COMMAND, undefined),
        },
      });
      requestAnimationFrame(() => editor.focus());
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) {
        return;
      }
      setPhase({
        kind: "error",
        file,
        message: error instanceof Error ? error.message : t.importFailed,
        retry: true,
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const take = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const type = detectImportType(file);
    if (!type || (type === "pdf" && !transfer.canImportPdf)) {
      setPhase({
        kind: "pick",
        error: transfer.canImportPdf ? UNSUPPORTED_IMPORT_MESSAGE : t.importUnsupportedNoPdf,
      });
      return;
    }
    const sizeError = type === "pdf" ? pdfSizeError(file) : null;
    if (sizeError) {
      setPhase({ kind: "error", file, message: sizeError, retry: false });
      return;
    }
    if (transfer.isEmpty()) {
      void run(file);
    } else {
      setPhase({ kind: "confirm", file });
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase({ kind: "pick" });
  };

  const chooseFile = () => inputRef.current?.click();

  const dropHandlers =
    phase.kind === "pick" || phase.kind === "error"
      ? {
          onDragOver: (event: DragEvent) => {
            event.preventDefault();
            setDragging(true);
          },
          onDragLeave: (event: DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragging(false);
            }
          },
          onDrop: (event: DragEvent) => {
            event.preventDefault();
            setDragging(false);
            take(event.dataTransfer.files?.[0]);
          },
        }
      : {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPhase({ kind: "pick" });
        } else {
          cancel();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="gap-5 sm:max-w-md"
        // Focus the dialog, not the drop zone, so it opens without a focus ring.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
        {...dropHandlers}
      >
        <DialogHeader>
          <DialogTitle>{t.importTitle}</DialogTitle>
          <DialogDescription>{t.importDescription}</DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept={transfer.canImportPdf ? ALL_IMPORT_ACCEPT : ALL_IMPORT_ACCEPT.replace(".pdf,", "")}
          className="hidden"
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {phase.kind === "pick" ? (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={chooseFile}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                dragging ? "border-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/50",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
                <HugeiconsIcon icon={FileImportIcon} size={20} aria-hidden="true" />
              </span>
              <span>
                {dragging ? t.importDropNow : t.importDropHere}{" "}
                {dragging ? null : (
                  <span className="font-medium text-primary underline-offset-4 hover:underline">
                    {t.importChooseFile}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {transfer.canImportPdf
                  ? `${t.importFormats} · ${t.importPdfLimit.replace("{size}", String(MAX_PDF_SIZE_MB)).replace("{pages}", String(MAX_PDF_PAGES))}`
                  : t.importFormatsNoPdf}
              </span>
            </button>
            {phase.error ? (
              <p role="alert" className="flex items-start gap-2 text-destructive">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} className="mt-1 shrink-0" aria-hidden="true" />
                <span>{phase.error}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3">
            <FileRow file={phase.file} busy={phase.kind === "working"} />
            {phase.kind === "confirm" ? (
              <p className="flex items-start gap-2 text-muted-foreground">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} className="mt-1 shrink-0" aria-hidden="true" />
                <span>{t.importReplaceWarning}</span>
              </p>
            ) : null}
            {phase.kind === "working" ? (
              <p aria-live="polite" className="text-muted-foreground">
                {t[STEP_LABELS[phase.step]]}
              </p>
            ) : null}
            {phase.kind === "error" ? (
              <p role="alert" className="flex items-start gap-2 text-destructive">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} className="mt-1 shrink-0" aria-hidden="true" />
                <span>{phase.message}</span>
              </p>
            ) : null}
          </div>
        )}

        {phase.kind !== "pick" ? (
          <DialogFooter>
            {phase.kind === "confirm" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setPhase({ kind: "pick" })}>
                  {t.importOtherFile}
                </Button>
                <Button type="button" autoFocus onClick={() => void run(phase.file)}>
                  {t.importReplace}
                </Button>
              </>
            ) : null}
            {phase.kind === "working" ? (
              <Button type="button" variant="ghost" onClick={cancel}>
                {t.cancel}
              </Button>
            ) : null}
            {phase.kind === "error" ? (
              <>
                <Button type="button" variant="ghost" onClick={chooseFile}>
                  {t.importOtherFile}
                </Button>
                {phase.retry ? (
                  <Button type="button" onClick={() => take(phase.file)}>
                    {t.aiTryAgain}
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
