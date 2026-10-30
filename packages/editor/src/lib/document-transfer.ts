/**
 * Editor-agnostic pieces of document import and export, used by the Lexical
 * editor, which turns HTML into its content and back.
 */

export const MAX_PDF_SIZE_MB = 50;
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
/**
 * PDF and Word export limits, checked by `/api/export/pdf` and
 * `/api/export/docx` (and the text limit on the client too). Exports run in one
 * request; much larger documents would need conversion in the background.
 */
/** The export HTML before images are embedded: text, tables, images as links. */
export const MAX_EXPORT_HTML_BYTES = 2 * 1024 * 1024;
/** After images are embedded (scaled to 1600 px), as base64. */
export const MAX_EXPORT_BYTES_WITH_IMAGES = 40 * 1024 * 1024;
/** Distinct images in one export. */
export const MAX_EXPORT_IMAGES = 200;

export const EXPORT_TOO_LARGE_MESSAGE =
  "This document has too much content to export at once (over 2 MB of text and tables). Split it into smaller documents, or export as HTML or Markdown.";
export const EXPORT_IMAGES_TOO_LARGE_MESSAGE =
  "This document's images add up to more than 40 MB, too much to export together. Remove or shrink some large images, or export as HTML or Markdown.";

export function exportTooManyImagesMessage(count: number) {
  return `This document has ${count} images, and an export can include up to ${MAX_EXPORT_IMAGES}. Remove some images, or export as HTML or Markdown.`;
}
export const UNSUPPORTED_IMPORT_MESSAGE =
  "Unsupported file type. Use PDF, DOCX, HTML, or Markdown.";

export type DocumentImportType = "html" | "markdown" | "docx" | "pdf";
export type DocumentExportType = "pdf" | "docx" | "html" | "markdown";

export const IMPORT_ACCEPT: Record<DocumentImportType, string> = {
  html: ".html,.htm",
  markdown: ".md,.markdown,.txt",
  docx: ".docx",
  pdf: ".pdf",
};

export const ALL_IMPORT_ACCEPT = ".pdf,.docx,.html,.htm,.md,.markdown,.txt";

export function detectImportType(file: File): DocumentImportType | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "md" || ext === "markdown" || ext === "txt") return "markdown";
  return null;
}

/** The size check the PDF importer runs before uploading; `null` when the file fits. */
export function pdfSizeError(file: File): string | null {
  if (file.size <= MAX_PDF_SIZE_BYTES) return null;
  return `PDF must be ${MAX_PDF_SIZE_MB}MB or smaller — this file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
}

export function ensureFullHtmlDocument(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return "<!doctype html><html><head></head><body></body></html>";
  if (/<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${trimmed}</body></html>`;
}

export function isExportHtmlTooLarge(html: string) {
  return new Blob([html]).size > MAX_EXPORT_HTML_BYTES;
}

export function exportFileName(ext: string, title?: string) {
  const base =
    title
      ?.trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || `document-${new Date().toISOString().split("T")[0]}`;
  return `${base}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function base64ToFile(contentType: string, base64: string, name: string) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], name, { type: contentType });
}

/**
 * DOCX to HTML through `mammoth`, uploading each embedded image with
 * `uploadImage` so the HTML holds stored references instead of data URLs.
 */
export async function convertDocxToHtml(
  file: File,
  {
    uploadImage,
    onImageUpload,
  }: {
    uploadImage: (image: File) => Promise<string>;
    onImageUpload?: () => void;
  },
): Promise<string> {
  const { default: mammoth } = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        onImageUpload?.();
        const contentType = image.contentType || "image/png";
        const extension = contentType.split("/")[1] ?? "png";
        const base64 = await image.read("base64");
        const src = await uploadImage(
          base64ToFile(contentType, base64, `inline-image-${Date.now()}.${extension}`),
        );
        return { src };
      }),
    },
  );
  return value;
}
