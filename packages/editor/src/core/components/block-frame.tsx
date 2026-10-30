"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

import {
  ArrowExpand01Icon,
  ArrowShrinkIcon,
  CommentAdd01Icon,
  MoreHorizontalIcon,
  SubtitleIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import type { NodeKey } from "lexical";

import { Button } from "../../ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import { cn } from "../../lib/utils";

import { useDocumentUi } from "../document/ui-context";
import { INSERT_MEDIA_COMMENT_COMMAND } from "../extensions/comment";
import {
  type BlockAlign,
  type BlockSize,
  blockBoxStyle,
  clampPercent,
  isFit,
  MIN_WIDTH_PERCENT,
  snapPercent,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";

import { BlockMenuContent } from "./block-menu";
import { MediaCaption } from "./media-view";

const KEY_STEP = 5;
const KEY_STEP_LARGE = 10;

function ToolbarButton({
  icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  icon: IconSvgElement;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          className={cn("size-7", pressed && "bg-accent text-accent-foreground")}
          onClick={onClick}
        >
          <HugeiconsIcon icon={icon} size={16} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The frame around a media or embed block in the editor: width, alignment
 * and caption (shared with read-only through `block-layout`), side handles to
 * resize, a hover toolbar, and the block menu.
 *
 * Resizing: drag either side handle (a centered block grows on both sides),
 * widths snap to 25/33/50/66/75/100% unless Alt is held, a badge shows the
 * width, double-click a handle to fit the column, and with a handle focused
 * the arrow keys change the width by 5% (Shift: 10%).
 */
export function BlockFrame({
  nodeKey,
  label,
  size,
  align,
  resizable = false,
  onResize,
  onAlign,
  caption,
  onCaption,
  toolbar = "full",
  inline = false,
  children,
}: {
  nodeKey: NodeKey;
  /** What the block is called in comments and labels ("photo.png", "YouTube video"). */
  label: string;
  size: BlockSize;
  align: BlockAlign;
  resizable?: boolean;
  /** A new width in percent, or undefined for Fit. */
  onResize?: (widthPercent: number | undefined) => void;
  onAlign?: (align: BlockAlign) => void;
  caption: string | undefined;
  onCaption: (caption: string | null) => void;
  /**
   * "full": align, fit, caption, comment and ⋯.
   * "menu": only ⋯ (audio and file rows).
   */
  toolbar?: "full" | "menu";
  /** Inside a paragraph (images): rendered with inline-level elements. */
  inline?: boolean;
  children: ReactNode;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { openComments, showComments } = useDocumentUi();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const frameRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const [livePercent, setLivePercent] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fit = isFit(size);
  // At Fit most blocks fill the column; X posts stop at 550 px and can still be aligned.
  const fillsColumn = fit && size.maxPx === undefined;
  const canResize = isEditable && resizable && onResize !== undefined;

  const columnWidth = () => frameRef.current?.clientWidth ?? 0;

  /** The current width as a percentage of the column. */
  const currentPercent = () => {
    if (size.widthPercent !== undefined) return size.widthPercent;
    const column = columnWidth();
    const box = boxRef.current?.getBoundingClientRect().width ?? column;
    return column > 0 ? clampPercent((box / column) * 100) : 100;
  };

  /** Applies the px limits (X posts: 250–550 px) to a percentage. */
  const limitPercent = (percent: number) => {
    const column = columnWidth();
    if (column <= 0) return clampPercent(percent);
    let px = (percent / 100) * column;
    if (size.minPx !== undefined) px = Math.max(px, Math.min(size.minPx, column));
    if (size.maxPx !== undefined) px = Math.min(px, size.maxPx);
    return clampPercent((px / column) * 100);
  };

  const commit = (percent: number) => {
    const rounded = Math.round(percent);
    onResize?.(rounded >= 100 ? undefined : rounded);
  };

  const startResize = (event: PointerEvent<HTMLSpanElement>, side: "start" | "end") => {
    const frame = frameRef.current;
    const box = boxRef.current;
    if (!canResize || !frame || !box || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const column = frame.clientWidth;
    const rtl = getComputedStyle(frame).direction === "rtl";
    const startWidth = box.getBoundingClientRect().width;
    const startX = event.clientX;
    // Moving the end handle right (left in RTL) widens; the start handle mirrors it.
    const outward = (side === "end") !== rtl ? 1 : -1;
    // A centered block grows on both sides, so it keeps up with the pointer.
    const factor = align === "center" ? 2 : 1;
    let percent = currentPercent();

    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const px = startWidth + (moveEvent.clientX - startX) * outward * factor;
      percent = limitPercent((px / column) * 100);
      if (!moveEvent.altKey) percent = snapPercent(percent);
      setLivePercent(percent);
    };
    const finish = (commitWidth: boolean) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      setLivePercent(null);
      if (commitWidth) commit(percent);
    };
    const up = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId === pointerId) finish(true);
    };
    const cancel = (cancelEvent: globalThis.PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) finish(false);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
    handle.setPointerCapture(pointerId);
    setLivePercent(percent);
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const rtl = frameRef.current ? getComputedStyle(frameRef.current).direction === "rtl" : false;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = currentPercent() + (rtl ? -step : step);
    if (event.key === "ArrowLeft") next = currentPercent() + (rtl ? step : -step);
    if (event.key === "Home") next = MIN_WIDTH_PERCENT;
    if (event.key === "End" || event.key === "Enter") next = 100;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    commit(limitPercent(next));
  };

  const shownPercent = livePercent ?? (fit ? 100 : size.widthPercent);
  const boxStyle =
    livePercent !== null
      ? { ...blockBoxStyle(size), width: `${livePercent}%` }
      : blockBoxStyle(size);
  const chromeVisible = isSelected || menuOpen || livePercent !== null;

  const handle = (side: "start" | "end") => (
    <span
      role="slider"
      tabIndex={0}
      aria-label={t.blockResize}
      aria-orientation="horizontal"
      aria-valuemin={MIN_WIDTH_PERCENT}
      aria-valuemax={100}
      aria-valuenow={Math.round(shownPercent ?? 100)}
      aria-valuetext={`${Math.round(shownPercent ?? 100)}%`}
      data-block-resize={side}
      onPointerDown={(event) => startResize(event, side)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onResize?.(undefined);
      }}
      onKeyDown={onHandleKeyDown}
      className={cn(
        // A wide invisible hit area around a thin pill.
        "absolute top-1/2 z-10 flex h-14 max-h-[70%] w-4 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full outline-none",
        "opacity-0 transition-opacity group-hover/block:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        side === "start" ? "start-1" : "end-1",
        chromeVisible && "opacity-100",
        "focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-primary/50",
      )}
    >
      <span className="block h-full w-1.5 rounded-full border border-background/80 bg-foreground/55 shadow-sm" />
    </span>
  );

  const toolbarButtons = toolbar === "full" ? (
    <>
      {onAlign ? (
        <>
          {(
            [
              ["left", TextAlignLeftIcon, t.alignLeft],
              ["center", TextAlignCenterIcon, t.alignCenter],
              ["right", TextAlignRightIcon, t.alignRight],
            ] as const
          ).map(([value, icon, alignLabel]) => (
            <ToolbarButton
              key={value}
              icon={icon}
              label={fillsColumn ? `${alignLabel} (${t.blockAlignNeedsWidth})` : alignLabel}
              pressed={!fillsColumn && align === value}
              disabled={fillsColumn}
              onClick={() => onAlign(value)}
            />
          ))}
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        </>
      ) : null}
      {resizable && onResize ? (
        // Names what a click does: leave full width (to 75%) or fit the column.
        <ToolbarButton
          icon={fit ? ArrowShrinkIcon : ArrowExpand01Icon}
          label={fit ? t.blockExitFit : t.blockFit}
          pressed={fit}
          onClick={() => onResize(fit ? 75 : undefined)}
        />
      ) : null}
      <ToolbarButton
        icon={SubtitleIcon}
        label={t.mediaCaption}
        pressed={caption !== undefined}
        onClick={() => onCaption(caption === undefined ? "" : null)}
      />
      {showComments ? (
        <ToolbarButton
          icon={CommentAdd01Icon}
          label={t.addComment}
          onClick={() => {
            openComments();
            editor.dispatchCommand(INSERT_MEDIA_COMMENT_COMMAND, { nodeKey, quote: label });
          }}
        />
      ) : null}
    </>
  ) : null;

  return (
    <span
      ref={frameRef}
      data-block-frame=""
      className={cn("group/block relative block w-full", inline && "py-2.5")}
      style={{ textAlign: fillsColumn ? undefined : align }}
    >
      <span
        ref={boxRef}
        className={cn(
          "relative inline-block max-w-full text-start align-top",
          isEditable && "rounded-md outline-1 outline-offset-4 outline-transparent transition-[outline-color]",
          isEditable && "group-hover/block:outline-border",
          isSelected && isEditable && "outline-2 outline-primary group-hover/block:outline-primary",
        )}
        style={boxStyle}
      >
        <span
          className={cn(
            "relative block",
            // Embedded frames would swallow the pointer while resizing.
            livePercent !== null && "[&_iframe]:pointer-events-none [&_video]:pointer-events-none",
          )}
        >
          {children}
          {canResize ? (
            <>
              {handle("start")}
              {handle("end")}
            </>
          ) : null}
          {livePercent !== null ? (
            <span className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-md bg-foreground/80 px-1.5 py-0.5 text-xs font-medium text-background tabular-nums">
              {Math.round(livePercent)}%
            </span>
          ) : null}
        </span>
        {isEditable ? (
          <span
            role="toolbar"
            aria-label={t.mediaOptions}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "absolute top-2 end-2 z-20 flex items-center gap-0.5 rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm",
              "opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
              chromeVisible && "opacity-100",
            )}
          >
            {toolbarButtons}
            <DropdownMenu modal={false} onOpenChange={setMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.moreActions}
                      className="size-7 data-[state=open]:bg-accent"
                    >
                      <HugeiconsIcon icon={MoreHorizontalIcon} size={16} aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">{t.moreActions}</TooltipContent>
              </Tooltip>
              <BlockMenuContent nodeKey={nodeKey} label={label} />
            </DropdownMenu>
          </span>
        ) : null}
        <MediaCaption caption={caption} editable={isEditable} onChange={onCaption} />
      </span>
    </span>
  );
}
