"use client";

import { type ReactNode, useCallback, useState } from "react";

import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

import {
  alignFromAttribute,
  type BlockSize,
  parseWidthPercent,
  TWEET_MAX_PX,
  TWEET_MIN_PX,
} from "../lib/block-layout";
import { parseBoardColumns } from "../lib/board";
import { documentTheme } from "../lib/theme";


import { BoardSurface } from "./board/board-surface";
import {
  AudioView,
  FileView,
  ImageView,
  ReadonlyBlock,
  VideoView,
} from "./media-view";
import { MentionChip } from "./mention-chip";
import { TweetEmbed } from "./tweet-embed";

type Island = { key: string; host: HTMLElement; node: ReactNode };

const ISLAND_ATTRIBUTE = "data-lexical-island";
/** Width of the toggle chevron area (`pl-6`), the only part of the title that toggles. */
const TOGGLE_ARROW_WIDTH = 24;

const noop = () => undefined;

function numberAttribute(element: Element, name: string): number | undefined {
  const value = Number(element.getAttribute(name));
  return value > 0 ? value : undefined;
}

/** Width as exported: a percentage, or an older pixel width. */
function sizeOf(element: HTMLElement): BlockSize {
  const widthPercent = parseWidthPercent(element.dataset.widthPercent);
  return {
    widthPercent,
    legacyWidthPx: widthPercent === undefined ? numberAttribute(element, "width") : undefined,
  };
}

/**
 * The host React renders into, placed right after the exported element. The
 * export stays in the DOM, hidden, as the fallback without scripts; reusing an
 * existing host keeps repeated scans (StrictMode) from adding a second one.
 */
function islandHost(target: HTMLElement, tag: "span" | "div"): HTMLElement {
  const next = target.nextElementSibling;
  if (next instanceof HTMLElement && next.hasAttribute(ISLAND_ATTRIBUTE)) {
    return next;
  }
  const host = target.ownerDocument.createElement(tag);
  host.setAttribute(ISLAND_ATTRIBUTE, "");
  target.after(host);
  target.hidden = true;
  return host;
}

/** Finds exported nodes and the editor component each one becomes in read-only. */
function collectIslands(root: HTMLElement): Island[] {
  const islands: Island[] = [];
  const add = (
    kind: string,
    selector: string,
    tag: "span" | "div",
    render: (element: HTMLElement) => ReactNode,
  ) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
      if (element.closest(`[${ISLAND_ATTRIBUTE}]`)) {
        return;
      }
      islands.push({
        key: `${kind}-${index}`,
        host: islandHost(element, tag),
        node: render(element),
      });
    });
  };

  add("mention", "span[data-lexical-mention]", "span", (element) => (
    <MentionChip
      entityType={element.dataset.entityType ?? ""}
      entityId={element.dataset.entityId ?? ""}
      title={element.dataset.title ?? element.textContent ?? ""}
      href={element.dataset.href ?? ""}
    />
  ));

  add("board", "div[data-lexical-board]", "div", (element) => {
    let columns: ReturnType<typeof parseBoardColumns> = [];
    try {
      columns = parseBoardColumns(JSON.parse(element.dataset.boardColumns ?? "[]"));
    } catch {
      columns = [];
    }
    return (
      <BoardSurface
        title={element.dataset.boardTitle ?? ""}
        columns={columns}
        isEditable={false}
        onChange={noop}
      />
    );
  });

  add("tweet", "div[data-lexical-tweet-id]", "div", (element) => (
    <div className="relative my-5">
      <ReadonlyBlock
        size={{
          widthPercent: parseWidthPercent(element.dataset.widthPercent),
          minPx: TWEET_MIN_PX,
          maxPx: TWEET_MAX_PX,
        }}
        align={alignFromAttribute(element.dataset.align)}
        caption={element.dataset.caption}
      >
        <TweetEmbed tweetID={element.dataset.lexicalTweetId ?? ""} />
      </ReadonlyBlock>
    </div>
  ));

  add("youtube", "iframe[data-lexical-youtube]", "div", (element) => (
    <div className="relative my-5">
      <ReadonlyBlock
        size={{ widthPercent: parseWidthPercent(element.dataset.widthPercent) }}
        align={alignFromAttribute(element.dataset.align)}
        caption={element.dataset.caption}
      >
        <iframe
          title="YouTube video"
          src={`https://www.youtube-nocookie.com/embed/${element.dataset.lexicalYoutube ?? ""}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="block aspect-video h-auto w-full max-w-full rounded-md border-0"
        />
      </ReadonlyBlock>
    </div>
  ));

  add("image", "img[src]", "span", (element) => (
    <ImageView
      src={element.getAttribute("src") ?? ""}
      altText={element.getAttribute("alt") ?? ""}
      caption={element.dataset.caption}
      size={sizeOf(element)}
      align={alignFromAttribute(element.dataset.align)}
    />
  ));

  add("video", "video[data-lexical-video]", "div", (element) => {
    const width = numberAttribute(element, "width");
    const height = numberAttribute(element, "height");
    const size = sizeOf(element);
    return (
      <div className="relative my-5">
        <VideoView
          src={element.dataset.lexicalVideo || element.getAttribute("src") || ""}
          name={element.dataset.name ?? ""}
          caption={element.dataset.caption}
          size={size}
          align={alignFromAttribute(element.dataset.align)}
          aspectRatio={
            size.widthPercent === undefined && width && height ? `${width} / ${height}` : undefined
          }
        />
      </div>
    );
  });

  add("audio", "audio[data-lexical-audio]", "div", (element) => (
    <div className="relative my-5">
      <AudioView
        src={element.dataset.lexicalAudio || element.getAttribute("src") || ""}
        name={element.dataset.name ?? ""}
        caption={element.dataset.caption}
      />
    </div>
  ));

  add("file", "a[data-lexical-file]", "div", (element) => (
    <div className="relative my-5">
      <FileView
        src={element.dataset.lexicalFile || element.getAttribute("href") || ""}
        name={element.dataset.name || element.textContent || "File"}
        caption={element.dataset.caption}
      />
    </div>
  ));

  return islands;
}

/** Code exports have no gutter; number the lines as the editor does. */
function addCodeGutters(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".lexical-code").forEach((code) => {
    if (code.hasAttribute("data-gutter")) {
      return;
    }
    const lines = code.querySelectorAll("br").length + 1;
    code.setAttribute(
      "data-gutter",
      Array.from({ length: lines }, (_, index) => index + 1).join("\n"),
    );
  });
}

/** The header fill Lexical's table export hard-codes (`#f2f3f5`), as the browser serializes it. */
const EXPORT_HEADER_FILL = "rgb(242, 243, 245)";

/**
 * Lexical's table cell export writes light-mode inline styles: a black border,
 * a `#f2f3f5` header fill, and top alignment. They keep borders visible when the
 * HTML is pasted elsewhere, so the export keeps them; here they are dropped so
 * the cell's theme classes (themed border, `bg-muted/50` header, centered
 * content) apply as in the editor, in light and dark mode. Column widths and
 * chosen cell colors stay.
 */
function normalizeTableCells(root: HTMLElement) {
  root
    .querySelectorAll<HTMLTableCellElement>("td.lexical-table-cell, th.lexical-table-cell")
    .forEach((cell) => {
      cell.style.removeProperty("border");
      if (cell.style.backgroundColor === EXPORT_HEADER_FILL) {
        cell.style.removeProperty("background-color");
      }
      if (cell.style.verticalAlign === "top") {
        cell.style.removeProperty("vertical-align");
      }
    });
}

const TABLE_WRAPPER_CLASS = String(documentTheme.tableScrollableWrapper ?? "");

/**
 * Tables export bare, without the editor's scroll wrapper, so a wide one would
 * spill out of the column. Each gets the same wrapper here and scrolls
 * sideways, as in the editor and like boards.
 */
function wrapTables(root: HTMLElement) {
  root.querySelectorAll("table").forEach((table) => {
    const parent = table.parentElement;
    if (!parent || parent.classList.contains("lexical-table-scrollable-wrapper")) {
      return;
    }
    const wrapper = table.ownerDocument.createElement("div");
    wrapper.className = TABLE_WRAPPER_CLASS;
    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

/** Toggle headings and lists open and close from their chevron, without saving. */
function enableToggles(root: HTMLElement) {
  const onClick = (event: MouseEvent) => {
    const title =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-toggle-title]")
        : null;
    const toggle = title?.closest<HTMLElement>("[data-toggle]");
    if (!title || !toggle || !root.contains(toggle)) {
      return;
    }
    const rect = title.getBoundingClientRect();
    const rtl = getComputedStyle(title).direction === "rtl";
    const onArrow = rtl
      ? event.clientX >= rect.right - TOGGLE_ARROW_WIDTH
      : event.clientX <= rect.left + TOGGLE_ARROW_WIDTH;
    if (onArrow) {
      toggle.dataset.open = toggle.dataset.open === "false" ? "true" : "false";
    }
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

/**
 * Sanitized editor HTML with the editor's own components mounted over the
 * nodes that have them (mentions, boards, embeds, media), so read-only looks
 * and behaves like the editor without loading Lexical. Interactions that only
 * change the view work; anything that would change the document is off.
 */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  const [islands, setIslands] = useState<Island[]>([]);

  // The container is keyed by the HTML, so this runs once per HTML version.
  const attach = useCallback((root: HTMLDivElement | null) => {
    if (!root) {
      return;
    }
    addCodeGutters(root);
    normalizeTableCells(root);
    wrapTables(root);
    setIslands(collectIslands(root));
    const disableToggles = enableToggles(root);
    return () => {
      disableToggles();
      setIslands([]);
    };
  }, []);

  return (
    <>
      <div
        key={html}
        ref={attach}
        className={cn(
          "leading-6 text-foreground [&_a:not([data-lexical-island]_a)]:text-[rgb(102,102,250)] [&_a:not([data-lexical-island]_a)]:underline",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {islands.map((island) =>
        createPortal(island.node, island.host, island.key),
      )}
    </>
  );
}
