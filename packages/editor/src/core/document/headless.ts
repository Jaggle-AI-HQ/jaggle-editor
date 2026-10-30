import { buildEditorFromExtensions } from "@lexical/extension";
import { $generateHtmlFromNodes } from "@lexical/html";
import { ReactProviderExtension } from "@lexical/react/ReactProviderExtension";
import { defineExtension } from "lexical";

import type { ExportAdapter, FilesAdapter } from "../../adapters/types";
import {
  type DocumentExportType,
  downloadBlob,
  EXPORT_TOO_LARGE_MESSAGE,
  exportFileName,
  isExportHtmlTooLarge,
} from "../../lib/document-transfer";

import { DocumentExtension } from "../extensions/document";
import {
  $replaceWithHtml,
  $replaceWithMarkdown,
  buildExportDocument,
  exportMarkdown,
} from "../lib/transfer";

/** An editor with the document's nodes and no view, for work on saved content. */
export function createHeadlessDocumentEditor() {
  return buildEditorFromExtensions(
    defineExtension({
      name: "@jaggle/lexical/headless-document",
      dependencies: [ReactProviderExtension, DocumentExtension],
      $initialEditorState: null,
    }),
  );
}

/** Markdown as the HTML the editor saves for the same content. */
export function documentHtmlFromMarkdown(markdown: string): string {
  const editor = createHeadlessDocumentEditor();
  try {
    editor.update(() => $replaceWithMarkdown(markdown), { discrete: true });
    return editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null));
  } finally {
    editor.dispose();
  }
}

/** What an export needs from the app: file URLs, and PDF and Word rendering. */
export type ExportServices = {
  files?: Pick<FilesAdapter, "resolveUrl">;
  exporter?: ExportAdapter;
};

/**
 * PDF or Word from a complete export document, through the app's `exporter`.
 * Checks the size the export routes accept first.
 */
export async function renderExport(
  exporter: ExportAdapter | undefined,
  format: "pdf" | "docx",
  html: string,
): Promise<Blob> {
  if (!exporter) {
    throw new Error(`Export as ${format.toUpperCase()} isn't available here.`);
  }
  if (isExportHtmlTooLarge(html)) {
    throw new Error(EXPORT_TOO_LARGE_MESSAGE);
  }
  return exporter.render(format, html);
}

/**
 * Downloads saved document HTML (`editor-state` content) in an export format,
 * through the same export as the editor's Export menu. For pages that show a
 * document without opening the editor.
 */
export async function exportDocumentHtml(
  html: string,
  format: DocumentExportType,
  title?: string,
  services: ExportServices = {},
): Promise<void> {
  const editor = createHeadlessDocumentEditor();
  try {
    editor.update(() => $replaceWithHtml(html), { discrete: true });
    if (format === "markdown") {
      downloadBlob(
        new Blob([exportMarkdown(editor)], { type: "text/markdown" }),
        exportFileName("md", title),
      );
      return;
    }
    const exported = await buildExportDocument(editor, {
      target: format,
      title,
      resolveFileUrl: services.files?.resolveUrl,
    });
    if (format === "html") {
      downloadBlob(new Blob([exported], { type: "text/html" }), exportFileName("html", title));
      return;
    }
    downloadBlob(
      await renderExport(services.exporter, format, exported),
      exportFileName(format, title),
    );
  } finally {
    editor.dispose();
  }
}
