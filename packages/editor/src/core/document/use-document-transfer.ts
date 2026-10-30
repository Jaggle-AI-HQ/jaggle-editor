"use client";

import { useCallback } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HISTORY_PUSH_TAG } from "lexical";

import {
  convertDocxToHtml,
  detectImportType,
  type DocumentExportType,
  downloadBlob,
  exportFileName,
  pdfSizeError,
  UNSUPPORTED_IMPORT_MESSAGE,
} from "../../lib/document-transfer";
import { useEditorAdapters } from "../../adapters/context";

import {
  $isDocumentEmpty,
  $replaceWithHtml,
  $replaceWithMarkdown,
  buildExportDocument,
  exportMarkdown,
  uploadEmbeddedImages,
} from "../lib/transfer";
import type { ImageUploadScope } from "../lib/types";
import { uploadEditorImage } from "../utils/images";

import { renderExport } from "./headless";

export type ImportStep =
  | "reading"
  | "converting"
  | "uploading-images"
  | "uploading-pdf"
  | "processing-pdf";

/**
 * Import and export for the document editor. HTML, Markdown and Word convert
 * here; PDF import and PDF/Word export go through the app's `importer` and
 * `exporter` adapters.
 */
export function useDocumentTransfer({
  imageScope,
  title,
}: {
  imageScope?: ImageUploadScope;
  title?: string;
}) {
  const [editor] = useLexicalComposerContext();
  const { files, importer, exporter } = useEditorAdapters();

  const importFile = useCallback(
    async (
      file: File,
      {
        signal,
        onStep,
      }: { signal?: AbortSignal; onStep?: (step: ImportStep) => void } = {},
    ) => {
      const type = detectImportType(file);
      if (!type) {
        throw new Error(UNSUPPORTED_IMPORT_MESSAGE);
      }
      const upload = async (image: File) =>
        (await uploadEditorImage(image, imageScope, files)).src;

      let content: { html: string } | { markdown: string };
      if (type === "pdf") {
        const sizeError = pdfSizeError(file);
        if (sizeError) {
          throw new Error(sizeError);
        }
        if (!importer) {
          throw new Error(UNSUPPORTED_IMPORT_MESSAGE);
        }
        if (!imageScope) {
          throw new Error("PDF import is available once the document is saved.");
        }
        onStep?.("uploading-pdf");
        content = {
          html: await importer.pdfToHtml(file, imageScope, {
            signal,
            onProcessing: () => onStep?.("processing-pdf"),
          }),
        };
      } else if (type === "docx") {
        onStep?.("converting");
        content = {
          html: await convertDocxToHtml(file, {
            uploadImage: upload,
            onImageUpload: () => onStep?.("uploading-images"),
          }),
        };
      } else {
        onStep?.("reading");
        const text = await uploadEmbeddedImages(await file.text(), upload, () =>
          onStep?.("uploading-images"),
        );
        content = type === "html" ? { html: text } : { markdown: text };
      }

      signal?.throwIfAborted();
      // One history entry, so a single undo brings the old document back.
      editor.update(
        () => {
          if ("html" in content) {
            $replaceWithHtml(content.html);
          } else {
            $replaceWithMarkdown(content.markdown);
          }
        },
        { tag: HISTORY_PUSH_TAG },
      );
    },
    [editor, files, imageScope, importer],
  );

  const exportAs = useCallback(
    async (format: DocumentExportType) => {
      if (format === "markdown") {
        downloadBlob(
          new Blob([exportMarkdown(editor)], { type: "text/markdown" }),
          exportFileName("md", title),
        );
        return;
      }
      const html = await buildExportDocument(editor, {
        target: format,
        title,
        resolveFileUrl: files?.resolveUrl,
      });
      if (format === "html") {
        downloadBlob(new Blob([html], { type: "text/html" }), exportFileName("html", title));
        return;
      }
      downloadBlob(await renderExport(exporter, format, html), exportFileName(format, title));
    },
    [editor, exporter, files, title],
  );

  const isEmpty = useCallback(() => editor.read($isDocumentEmpty), [editor]);

  return { importFile, exportAs, isEmpty, canImportPdf: Boolean(importer) };
}

export type DocumentTransfer = ReturnType<typeof useDocumentTransfer>;
