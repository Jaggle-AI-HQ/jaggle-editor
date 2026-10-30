import { $insertGeneratedNodes } from "@lexical/clipboard";
import {
  $generateHtmlFromNodes,
  $generateNodesFromDOMViaExtension,
} from "@lexical/html";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import katex from "katex";
import {
  $createParagraphNode,
  $getEditor,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  type LexicalEditor,
} from "lexical";


import { MARKDOWN_TRANSFORMERS } from "../extensions/document";
import { decodeEquation } from "../nodes/equation-node";
import { fileFromImageDataUrl } from "../utils/images";

import { EXPORT_CSS } from "./export-styles";

export type ExportTarget = "html" | "pdf" | "docx";

const FILE_REFERENCE = "jaggle-file://";
const DATA_IMAGE_URL = /data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+/gi;

// ---------------------------------------------------------------------------
// Import

/**
 * Uploads every embedded `data:image` URL in HTML or Markdown text and swaps
 * in the stored reference, so imported documents do not carry megabytes of
 * base64.
 */
export async function uploadEmbeddedImages(
  text: string,
  upload: (file: File) => Promise<string>,
  onUpload?: () => void,
): Promise<string> {
  const urls = Array.from(new Set(text.match(DATA_IMAGE_URL) ?? []));
  if (urls.length === 0) {
    return text;
  }
  onUpload?.();
  const uploaded = await Promise.all(
    urls.map(async (url) => {
      const file = fileFromImageDataUrl(url);
      return [url, file ? await upload(file) : ""] as const;
    }),
  );
  let result = text;
  for (const [url, src] of uploaded) {
    if (src) {
      result = result.split(url).join(src);
    }
  }
  return result;
}

/**
 * Replaces the document with imported HTML through the rule-based importer,
 * the same one paste uses, so every document node is recognized.
 */
export function $replaceWithHtml(html: string) {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const nodes = $generateNodesFromDOMViaExtension(dom);
  const root = $getRoot();
  root.clear();
  const paragraph = $createParagraphNode();
  root.append(paragraph);
  paragraph.select();
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    $insertGeneratedNodes($getEditor(), nodes, selection);
  }
  root.selectStart();
}

export function $replaceWithMarkdown(markdown: string) {
  $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS);
  $getRoot().selectStart();
}

export function $isDocumentEmpty(): boolean {
  const root = $getRoot();
  const first = root.getFirstChild();
  return (
    root.getChildrenSize() === 0 ||
    (root.getChildrenSize() === 1 && $isElementNode(first) && first.isEmpty())
  );
}

// ---------------------------------------------------------------------------
// Export

export function exportMarkdown(editor: LexicalEditor): string {
  return editor.read(() => $convertToMarkdownString(MARKDOWN_TRANSFORMERS));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function linkParagraph(doc: Document, href: string, label: string) {
  const paragraph = element(doc, "p");
  const link = element(doc, "a", label);
  link.href = href;
  paragraph.append(link);
  return paragraph;
}

/**
 * Stored file references become URLs through the app's `files.resolveUrl`
 * (they stay as they are without one); relative URLs become absolute.
 */
async function resolveUrls(
  body: HTMLElement,
  resolveFileUrl: ((src: string) => Promise<string>) | undefined,
) {
  const cache = new Map<string, Promise<string>>();
  const resolve = (value: string) => {
    if (!cache.has(value)) {
      cache.set(
        value,
        value.startsWith(FILE_REFERENCE)
          ? (resolveFileUrl?.(value) ?? Promise.resolve(value))
          : Promise.resolve(new URL(value, window.location.origin).href),
      );
    }
    return cache.get(value)!;
  };
  const attributes = ["src", "href", "data-lexical-video", "data-lexical-audio", "data-lexical-file"];
  const jobs: Promise<void>[] = [];
  for (const name of attributes) {
    body.querySelectorAll<HTMLElement>(`[${name}]`).forEach((node) => {
      const value = node.getAttribute(name);
      if (!value || /^(data|blob|mailto|tel):|^#/.test(value)) {
        return;
      }
      jobs.push(resolve(value).then((url) => node.setAttribute(name, url)));
    });
  }
  await Promise.all(jobs);
}

function convertEquations(doc: Document, body: HTMLElement, target: ExportTarget) {
  body.querySelectorAll<HTMLElement>("[data-lexical-equation]").forEach((node) => {
    let latex = "";
    try {
      latex = decodeEquation(node.dataset.lexicalEquation ?? "");
    } catch {
      latex = node.getAttribute("aria-label")?.replace(/^Equation: /, "") ?? "";
    }
    const block = node.dataset.lexicalInline !== "true";
    if (target === "docx") {
      // Word export has no math support; keep the source readable.
      const code = element(doc, "code", latex);
      if (block) {
        const paragraph = element(doc, "p");
        paragraph.append(code);
        node.replaceWith(paragraph);
      } else {
        node.replaceWith(code);
      }
      return;
    }
    // MathML renders natively in browsers and in the PDF renderer.
    node.innerHTML = katex.renderToString(latex, {
      displayMode: block,
      output: "mathml",
      throwOnError: false,
    });
  });
}

function convertChecklists(doc: Document, body: HTMLElement, target: ExportTarget) {
  body.querySelectorAll("ul").forEach((list) => {
    if (list.getAttribute("__lexicallisttype") === "check") {
      list.removeAttribute("__lexicallisttype");
      list.setAttribute("data-list", "check");
    }
  });
  if (target !== "docx") {
    return;
  }
  body.querySelectorAll<HTMLElement>('li[role="checkbox"]').forEach((item) => {
    const checked = item.getAttribute("aria-checked") === "true";
    item.prepend(doc.createTextNode(checked ? "☑ " : "☐ "));
    item.removeAttribute("role");
    item.removeAttribute("aria-checked");
  });
}

/**
 * The Word page's text width in px: Letter (12240 twips) less the converter's
 * 1800-twip margins is 8640 twips, at 15 twips per px.
 */
const DOCX_PAGE_WIDTH_PX = 576;

const CAPTIONED =
  "img[data-caption], video[data-caption], audio[data-caption], a[data-lexical-file][data-caption], iframe[data-caption], [data-lexical-tweet-id][data-caption]";

function convertMedia(doc: Document, body: HTMLElement, target: ExportTarget) {
  // Every media block's caption becomes a line right under it.
  body.querySelectorAll<HTMLElement>(CAPTIONED).forEach((media) => {
    const caption = media.dataset.caption?.trim();
    media.removeAttribute("data-caption");
    if (!caption) {
      return;
    }
    if (target === "docx") {
      if (media.tagName === "IMG") {
        media.after(element(doc, "br"), element(doc, "i", caption));
      } else {
        const paragraph = element(doc, "p");
        paragraph.append(element(doc, "i", caption));
        media.after(paragraph);
      }
      return;
    }
    const node = element(doc, media.tagName === "IMG" ? "span" : "p", caption);
    node.setAttribute("data-export-caption", "");
    // Same width and placement as the block, so the caption starts at its edge.
    for (const property of ["width", "max-width", "margin-left", "margin-right"]) {
      const value = media.style.getPropertyValue(property);
      if (value) node.style.setProperty(property, value);
    }
    media.after(node);
  });

  if (target === "docx") {
    body.querySelectorAll<HTMLImageElement>("img[data-width-percent]").forEach((image) => {
      const percent = Number(image.dataset.widthPercent);
      if (percent > 0) {
        image.setAttribute("width", String(Math.round((percent / 100) * DOCX_PAGE_WIDTH_PX)));
        image.removeAttribute("height");
      }
    });
  }

  body.querySelectorAll("[style*='grid-template-columns']").forEach((node) => {
    node.setAttribute("data-layout", "columns");
  });

  // Expand everything: exports are static.
  body.querySelectorAll("details").forEach((node) => node.setAttribute("open", ""));
  body.querySelectorAll<HTMLElement>("[data-toggle]").forEach((node) => {
    node.dataset.open = "true";
  });

  if (target === "html") {
    return;
  }
  // Paged formats cannot play media; link to it instead.
  body.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => {
    const url = media.getAttribute("src") ?? "";
    const name = media.dataset.name || url;
    media.replaceWith(linkParagraph(doc, url, `${media.tagName === "VIDEO" ? "Video" : "Audio"}: ${name}`));
  });
  body.querySelectorAll<HTMLIFrameElement>("iframe[data-lexical-youtube]").forEach((frame) => {
    const url = `https://www.youtube.com/watch?v=${frame.dataset.lexicalYoutube ?? ""}`;
    frame.replaceWith(linkParagraph(doc, url, `YouTube: ${url}`));
  });
}

type ExportedBoardColumn = {
  title: string;
  cards: { title: string; assignees: { name: string }[]; dueDate: string | null }[];
};

/** Word has no layout for cards; boards become a table and polls a list. */
function convertWidgetsForDocx(doc: Document, body: HTMLElement) {
  body.querySelectorAll<HTMLElement>("[data-lexical-board]").forEach((board) => {
    let columns: ExportedBoardColumn[] = [];
    try {
      columns = JSON.parse(board.dataset.boardColumns ?? "[]") as ExportedBoardColumn[];
    } catch {
      return;
    }
    const wrapper = element(doc, "div");
    const title = element(doc, "p");
    title.append(element(doc, "strong", board.dataset.boardTitle || "Board"));
    const table = element(doc, "table");
    const head = element(doc, "tr");
    for (const column of columns) {
      head.append(element(doc, "th", `${column.title} (${column.cards.length})`));
    }
    table.append(head);
    const rows = Math.max(0, ...columns.map((column) => column.cards.length));
    for (let index = 0; index < rows; index += 1) {
      const row = element(doc, "tr");
      for (const column of columns) {
        const card = column.cards[index];
        const meta = card
          ? [card.dueDate, card.assignees.map((person) => person.name).join(", ")].filter(Boolean)
          : [];
        row.append(element(doc, "td", card ? [card.title, ...meta].join(" · ") : ""));
      }
      table.append(row);
    }
    wrapper.append(title, table);
    board.replaceWith(wrapper);
  });

  body.querySelectorAll<HTMLElement>("[data-lexical-poll-question]").forEach((poll) => {
    let options: { text: string; votes: unknown[] }[] = [];
    try {
      options = JSON.parse(poll.dataset.lexicalPollOptions ?? "[]") as typeof options;
    } catch {
      return;
    }
    const wrapper = element(doc, "div");
    const question = element(doc, "p");
    question.append(element(doc, "strong", poll.dataset.lexicalPollQuestion ?? ""));
    const list = element(doc, "ul");
    for (const option of options) {
      const count = option.votes.length;
      list.append(element(doc, "li", `${option.text} — ${count} ${count === 1 ? "vote" : "votes"}`));
    }
    wrapper.append(question, list);
    (poll.closest("p") ?? poll).replaceWith(wrapper);
  });
}

/**
 * Word export drops a table that holds another table, with all its text. Each
 * table inside a cell moves out to just after the table that held it (in
 * order), and a table left with nothing in it goes away.
 */
function flattenNestedTablesForDocx(body: HTMLElement) {
  const placedAfter = new Map<Element, Element>();
  const emptied = new Set<HTMLTableElement>();
  let inner = body.querySelector<HTMLTableElement>("td table, th table");
  while (inner) {
    const outer = inner.parentElement?.closest("table");
    if (!outer) break;
    (placedAfter.get(outer) ?? outer).after(inner);
    placedAfter.set(outer, inner);
    emptied.add(outer);
    inner = body.querySelector<HTMLTableElement>("td table, th table");
  }
  for (const table of emptied) {
    if (!table.textContent?.trim() && !table.querySelector("img")) {
      table.remove();
    }
  }
}

function pixelWidth(node: HTMLElement): number {
  const value = node.style.width;
  return value.endsWith("px") ? Number.parseFloat(value) : 0;
}

/**
 * Word keeps a table's column widths even past the page edge, so a table
 * resized wider than the page loses its last columns off the right side.
 * Wider tables are scaled down to the page, columns keeping their proportions.
 */
function fitTablesForDocx(body: HTMLElement) {
  body.querySelectorAll("table").forEach((table) => {
    const cols = Array.from(table.querySelectorAll<HTMLElement>(":scope > colgroup > col"));
    const firstRow = table.querySelector("tr");
    const columnWidths = cols.length
      ? cols.map(pixelWidth)
      : Array.from(firstRow?.querySelectorAll<HTMLElement>(":scope > td, :scope > th") ?? []).map(pixelWidth);
    const total = columnWidths.reduce((sum, width) => sum + width, 0);
    if (total <= DOCX_PAGE_WIDTH_PX) return;
    const scale = DOCX_PAGE_WIDTH_PX / total;
    const resize = (node: HTMLElement) => {
      const width = pixelWidth(node);
      if (width > 0) node.style.width = `${Math.floor(width * scale)}px`;
    };
    cols.forEach(resize);
    table.querySelectorAll<HTMLElement>("td, th").forEach((cell) => {
      // Cells of a nested table belong to that table's own fitting.
      if (cell.closest("table") === table) resize(cell);
    });
    if (pixelWidth(table) > DOCX_PAGE_WIDTH_PX) table.style.width = `${DOCX_PAGE_WIDTH_PX}px`;
  });
}

function cleanUp(body: HTMLElement) {
  // Tailwind classes mean nothing outside the app; styles come from EXPORT_CSS.
  body.querySelectorAll("[class], [tabindex], [spellcheck]").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("tabindex");
    node.removeAttribute("spellcheck");
  });
  // The editor keeps an empty paragraph at the end for the caret.
  while (body.lastElementChild?.matches("p") && !body.lastElementChild.textContent?.trim() && !body.lastElementChild.querySelector("img")) {
    body.lastElementChild.remove();
  }
}

/**
 * The document as a standalone HTML file for a target: file references
 * resolved, equations as MathML (or LaTeX text for Word), media as links on
 * paged formats, widgets flattened for Word, and the export stylesheet.
 */
export async function buildExportDocument(
  editor: LexicalEditor,
  {
    target,
    title,
    resolveFileUrl,
  }: {
    target: ExportTarget;
    title?: string;
    /** The app's `files.resolveUrl`, so stored files export with a loadable URL. */
    resolveFileUrl?: (src: string) => Promise<string>;
  },
): Promise<string> {
  const html = editor.read(() => $generateHtmlFromNodes(editor, null));
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
  const body = doc.body;

  await resolveUrls(body, resolveFileUrl);
  convertEquations(doc, body, target);
  convertChecklists(doc, body, target);
  convertMedia(doc, body, target);
  if (target === "docx") {
    convertWidgetsForDocx(doc, body);
    flattenNestedTablesForDocx(body);
    fitTablesForDocx(body);
  }
  cleanUp(body);

  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title?.trim() || "Document")}</title>`,
    // Word ignores most CSS; its route adds the table styles it needs.
    target === "docx" ? "" : `<style>${EXPORT_CSS}</style>`,
  ].join("");
  const content = target === "docx" ? body.innerHTML : `<article>${body.innerHTML}</article>`;
  return `<!doctype html><html lang="en"><head>${head}</head><body>${content}</body></html>`;
}
