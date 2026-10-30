import type { CSSProperties } from "react";

/**
 * Size and placement shared by resizable blocks (image, video, YouTube, X
 * post) in the editor, the read-only view and exports. Lexical-free.
 *
 * Width is a percentage of the writing column, so a block looks the same at
 * any column width. No percentage means Fit (full column width). Documents
 * from before percentages may carry a pixel width, which keeps rendering,
 * capped at the column, until the block is resized again.
 */

export type BlockAlign = "left" | "center" | "right";

export const MIN_WIDTH_PERCENT = 15;
/** X's embed renders between these widths, so X posts resize within them. */
export const TWEET_MIN_PX = 250;
export const TWEET_MAX_PX = 550;
/** Resizes snap to these widths when released within 2% of one. */
export const SNAP_PERCENTS = [25, 33, 50, 66, 75, 100];
const SNAP_DISTANCE = 2;

/**
 * Alignment from a Lexical element format. Blocks narrower than the column
 * are centered unless set otherwise.
 */
export function alignFromFormat(format: string | null | undefined): BlockAlign {
  if (format === "left" || format === "start") return "left";
  if (format === "right" || format === "end") return "right";
  return "center";
}

export function alignFromAttribute(value: string | null | undefined): BlockAlign {
  return value === "left" || value === "right" ? value : "center";
}

export function snapPercent(percent: number): number {
  const target = SNAP_PERCENTS.find(
    (point) => Math.abs(point - percent) <= SNAP_DISTANCE,
  );
  return target ?? percent;
}

export function clampPercent(percent: number): number {
  return Math.min(100, Math.max(MIN_WIDTH_PERCENT, percent));
}

/** A stored percentage, or undefined (Fit) for missing or out-of-range values. */
export function parseWidthPercent(value: unknown): number | undefined {
  const percent = typeof value === "string" ? Number(value) : value;
  if (typeof percent !== "number" || !Number.isFinite(percent)) return undefined;
  if (percent <= 0 || percent >= 100) return undefined;
  return clampPercent(Math.round(percent));
}

export type BlockSize = {
  widthPercent?: number;
  /** Pixel width saved before percentages existed. */
  legacyWidthPx?: number;
  /** Narrowest and widest the block may render (X posts: 250 to 550 px). */
  minPx?: number;
  maxPx?: number;
};

export function isFit({ widthPercent, legacyWidthPx }: BlockSize): boolean {
  return widthPercent === undefined && legacyWidthPx === undefined;
}

/** Width styles for the box that holds the block and its caption. */
export function blockBoxStyle(size: BlockSize): CSSProperties {
  const width =
    size.widthPercent !== undefined
      ? `${size.widthPercent}%`
      : size.legacyWidthPx !== undefined
        ? `${size.legacyWidthPx}px`
        : "100%";
  return {
    width,
    maxWidth: size.maxPx !== undefined ? `min(100%, ${size.maxPx}px)` : "100%",
    minWidth: size.minPx !== undefined ? `min(100%, ${size.minPx}px)` : undefined,
  };
}

/** Inline styles that place a block on its own in exported HTML. */
export function exportBlockStyle(size: BlockSize, align: BlockAlign): string {
  const parts = ["display:block", "max-width:100%"];
  if (size.widthPercent !== undefined) {
    parts.push(`width:${size.widthPercent}%`);
  } else if (size.legacyWidthPx !== undefined) {
    parts.push(`width:${size.legacyWidthPx}px`);
  }
  if (!isFit(size)) {
    parts.push(
      align === "left"
        ? "margin-left:0;margin-right:auto"
        : align === "right"
          ? "margin-left:auto;margin-right:0"
          : "margin-left:auto;margin-right:auto",
    );
  }
  return parts.join(";");
}
