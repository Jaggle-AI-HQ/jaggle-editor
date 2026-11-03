"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  PencilEdit01Icon,
  Search01Icon,
  SmileIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { $isMarkNode, $wrapSelectionInMarkNode } from "@lexical/mark";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import { useExtensionSignalValue } from "@lexical/react/useExtensionSignalValue";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { createDOMRange, createRectsFromDOMRange } from "@lexical/selection";
import { $dfs, mergeRegister } from "@lexical/utils";
import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalEditor,
  type NodeKey,
  type RangeSelection,
  registerEventListener,
} from "lexical";
import {
  Check,
  ChevronDown,
  Ellipsis,
  MessageSquarePlus,
  MessageSquareText,
  RotateCcw,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/avatar";
import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../../../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";
import { cn } from "../../../lib/utils";

import {
  CommentBodyEditor,
  type CommentBodyEditorHandle,
} from "../../components/comment-body-editor";
import { HtmlView } from "../../components/html-view";
import { useThreadActions } from "../../document/comment-threads";
import { createId } from "../../document/thread-store";
import {
  $addMediaThread,
  CLOSE_COMMENT_INPUT_COMMAND,
  type Comment,
  CommentExtension,
  type CommentState,
  consumePendingSelection,
  INSERT_INLINE_COMMAND,
  removeThreadMarks,
  setComposerSlot,
  type Thread,
} from "../../extensions/comment";
import { useTranslation } from "../../lib/locale";
import type { CommentBody } from "../../lib/types";

import {
  revealInEditor,
  setFloatingAnchorRect,
  useFloatingCollisionBoundary,
} from "./floating-utils";

function CommentInputBox({
  editor,
  state,
}: {
  editor: LexicalEditor;
  state: CommentState;
}) {
  const { t, dir } = useTranslation();
  const bodyEditorRef = useRef<CommentBodyEditorHandle | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<RangeSelection | null>(null);
  const mediaAnchorRef = useRef<{ nodeKey: NodeKey; quote: string } | null>(null);
  const highlightsRef = useRef<HTMLDivElement | null>(null);
  const collisionBoundary = useFloatingCollisionBoundary(editor);

  const updateLocation = useCallback(() => {
    const pendingMediaAnchor = state.pendingMediaAnchor;
    if (pendingMediaAnchor) {
      mediaAnchorRef.current = pendingMediaAnchor;
      selectionRef.current = null;
    }

    const mediaAnchor = mediaAnchorRef.current;
    const triggerElem = triggerRef.current;
    if (mediaAnchor) {
      const anchorElement = editor.getElementByKey(mediaAnchor.nodeKey);
      if (anchorElement && triggerElem) {
        setFloatingAnchorRect(triggerElem, anchorElement.getBoundingClientRect());
      }
      if (highlightsRef.current) {
        highlightsRef.current.innerHTML = "";
      }
      return;
    }

    editor.read("latest", () => {
      const selection =
        consumePendingSelection(state) ??
        selectionRef.current ??
        $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }
      selectionRef.current = selection.clone();
      const range = createDOMRange(
        editor,
        selection.anchor.getNode(),
        selection.anchor.offset,
        selection.focus.getNode(),
        selection.focus.offset,
      );
      const triggerElem = triggerRef.current;
      const rootElement = editor.getRootElement();
      const parent = rootElement?.parentElement;
      if (range === null || !rootElement || !parent) {
        return;
      }
      // In the comments panel there is no popover to place; the highlight stays.
      if (triggerElem) {
        setFloatingAnchorRect(triggerElem, range.getBoundingClientRect());
      }

      let container = highlightsRef.current;
      if (container === null) {
        container = rootElement.ownerDocument.createElement("div");
        container.style.position = "absolute";
        container.style.top = "0";
        container.style.left = "0";
        container.style.pointerEvents = "none";
        parent.appendChild(container);
        highlightsRef.current = container;
      }
      container.innerHTML = "";
      const containerRect = container.getBoundingClientRect();
      for (const rect of createRectsFromDOMRange(editor, range)) {
        const span = rootElement.ownerDocument.createElement("span");
        span.className = "lexical-comment-highlight";
        span.style.top = `${rect.top - containerRect.top}px`;
        span.style.left = `${rect.left - containerRect.left}px`;
        span.style.width = `${rect.width}px`;
        span.style.height = `${rect.height}px`;
        container.appendChild(span);
      }
    });
  }, [editor, state]);

  useEffect(() => {
    updateLocation();
    return mergeRegister(
      registerEventListener(window, "resize", updateLocation),
      () => {
        highlightsRef.current?.remove();
        highlightsRef.current = null;
      },
    );
  }, [updateLocation]);

  const cancel = useCallback(() => {
    mediaAnchorRef.current = null;
    editor.update(() => {
      const selection = $getSelection();
      if (selection !== null) {
        selection.dirty = true;
      }
    });
    editor.dispatchCommand(CLOSE_COMMENT_INPUT_COMMAND, undefined);
  }, [editor]);

  const actions = useThreadActions();
  const submit = useCallback((body: CommentBody) => {
    const mediaAnchor = mediaAnchorRef.current;
    let quote = mediaAnchor?.quote ?? editor.read(
      "latest",
      () => selectionRef.current?.getTextContent() ?? "",
    );
    if (quote.length > 100) {
      quote = quote.slice(0, 99) + "…";
    }
    const id = createId();
    actions.createThread({ id, quote, anchor: mediaAnchor ? "media" : "text", body });
    editor.update(() => {
      if (mediaAnchor) {
        $addMediaThread(mediaAnchor.nodeKey, id);
        return;
      }
      const selection = selectionRef.current;
      if ($isRangeSelection(selection)) {
        $wrapSelectionInMarkNode(selection, selection.isBackward(), id);
      }
    });
    selectionRef.current = null;
    mediaAnchorRef.current = null;
    editor.dispatchCommand(CLOSE_COMMENT_INPUT_COMMAND, undefined);
  }, [actions, editor]);

  // With the comments panel open, the field opens at its top, under the text
  // it is about, as the panel's own threads read.
  const slot = useExtensionSignalValue(CommentExtension, "composerSlot");
  const quote = useMemo(
    () =>
      state.pendingMediaAnchor?.quote ??
      editor.read("latest", () => state.inputSelection?.getTextContent() ?? ""),
    [editor, state],
  );
  if (slot) {
    return createPortal(
      <div
        role="form"
        aria-label={t.comment}
        dir={dir}
        className="rounded-xl border border-primary/60 bg-card p-3 shadow-md ring-3 ring-primary/10"
      >
        {quote ? (
          <p className="line-clamp-2 rounded-md bg-amber-400/30 px-2 py-1 text-xs" title={quote}>
            {quote}
          </p>
        ) : null}
        <CommentBodyEditor
          ref={bodyEditorRef}
          autoFocus
          placeholder={t.typeComment}
          className="mt-1 min-h-20 text-[13px]"
          onSubmit={submit}
          onCancel={cancel}
          onEmptyChange={setIsEmpty}
        />
        <div className="mt-1 flex items-center gap-2 border-t pt-2">
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {t.commentComposerHint}
          </p>
          <Button variant="ghost" size="sm" onClick={cancel}>
            {t.cancel}
          </Button>
          <Button size="sm" disabled={isEmpty} onClick={() => bodyEditorRef.current?.submit()}>
            {t.comment}
          </Button>
        </div>
      </div>,
      slot,
    );
  }

  return (
    <Popover open>
      <PopoverAnchor
        ref={triggerRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 opacity-0"
        style={{ transform: "translate(-10000px, -10000px)" }}
      />
      <PopoverContent
        dir={dir}
        side="bottom"
        align="center"
        sideOffset={12}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        hideWhenDetached
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="flex w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        {/* The popover is the field: no box inside a box. */}
        <div className="p-1.5">
          <CommentBodyEditor
            ref={bodyEditorRef}
            autoFocus
            placeholder={t.typeComment}
            className="min-h-20"
            onSubmit={submit}
            onCancel={cancel}
            onEmptyChange={setIsEmpty}
          />
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {t.commentComposerHint}
          </p>
          <Button variant="ghost" size="sm" onClick={cancel}>
            {t.cancel}
          </Button>
          <Button
            size="sm"
            disabled={isEmpty}
            onClick={() => bodyEditorRef.current?.submit()}
          >
            {t.comment}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CommentPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const state = useExtensionDependency(CommentExtension).output;
  const showCommentInput = useExtensionSignalValue(
    CommentExtension,
    "showCommentInput",
  );
  const mediaAnchorRevision = useExtensionSignalValue(
    CommentExtension,
    "mediaAnchorRevision",
  );

  if (!isEditable || !showCommentInput) {
    return null;
  }
  return (
    <CommentInputBox
      key={mediaAnchorRevision}
      editor={editor}
      state={state}
    />
  );
}

/** Asks before deleting a comment or a whole thread. */
function DeleteConfirm({
  open,
  title,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const { t, dir } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={dir} onClick={stopPropagation}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>{t.delete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

/** Quick reactions, like the old editor's comment threads. */
const QUICK_REACTIONS = ["👍", "❤️", "😄", "🎉", "👀", "✅"];

function stopPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/** A round icon button with a tooltip, for a thread's and a comment's actions. */
function IconAction({
  label,
  className,
  children,
  onClick,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4",
            className,
          )}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Adds a reaction to a comment. */
function ReactionPicker({
  thread,
  comment,
  quiet,
}: {
  thread: Thread;
  comment: Comment;
  /** Out of the way until the comment is pointed at (it has no reactions yet). */
  quiet: boolean;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t.commentAddReaction}
              className={cn(
                "flex h-6 items-center justify-center rounded-full px-1.5 text-muted-foreground transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground focus-visible:opacity-100",
                quiet && !open && "opacity-0 group-hover/comment:opacity-100",
              )}
              onClick={stopPropagation}
            >
              <HugeiconsIcon icon={SmileIcon} size={14} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t.commentAddReaction}</TooltipContent>
      </Tooltip>
      {/* Portalled, but its clicks still reach the thread card through React. */}
      <PopoverContent
        align="start"
        className="flex w-auto gap-0.5 p-1"
        onClick={stopPropagation}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            className="flex size-8 items-center justify-center rounded-md text-lg transition-transform hover:scale-110 hover:bg-muted"
            onClick={() => {
              actions.toggleReaction(thread.id, comment.id, emoji);
              setOpen(false);
            }}
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** A comment's reactions, and the picker beside them. */
function Reactions({ thread, comment }: { thread: Thread; comment: Comment }) {
  const actions = useThreadActions();
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 ps-8">
      {comment.reactions.map((reaction) => {
        const mine = reaction.userIds.includes(actions.me.id);
        return (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={mine}
                onClick={() => actions.toggleReaction(thread.id, comment.id, reaction.emoji)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors hover:border-foreground/20",
                  mine && "border-primary/50 bg-primary/10 text-primary hover:border-primary/50",
                )}
              >
                <span aria-hidden="true" className="text-sm">{reaction.emoji}</span>
                {reaction.userIds.length}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {reaction.names.filter(Boolean).join(", ") || reaction.emoji}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <ReactionPicker thread={thread} comment={comment} quiet={comment.reactions.length === 0} />
    </div>
  );
}

/** "Just now", "5 min ago", "3 hr ago", "2 days ago". */
function useWhen(timeStamp: number, rtf: Intl.RelativeTimeFormat, now: number) {
  const { t } = useTranslation();
  const minutes = Math.round((timeStamp - now) / 60000);
  const hours = Math.round(minutes / 60);
  return minutes > -1
    ? t.justNow
    : minutes > -60
      ? rtf.format(minutes, "minute")
      : hours > -24
        ? rtf.format(hours, "hour")
        : rtf.format(Math.round(hours / 24), "day");
}

function CommentAvatar({ comment }: { comment: Comment }) {
  return (
    <Avatar className="size-6 shrink-0">
      {comment.authorAvatar ? <AvatarImage src={comment.authorAvatar} alt="" /> : null}
      <AvatarFallback seed={comment.authorId || comment.author} className="text-[10px] font-semibold">
        {initials(comment.author)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * One comment: who and when, its actions (the thread's resolve on the first
 * one, then a menu with Edit and Delete), the text and its reactions.
 */
function CommentRow({
  comment,
  thread,
  rtf,
  now,
  actions: rowActions,
  onDelete,
}: {
  comment: Comment;
  thread: Thread;
  rtf: Intl.RelativeTimeFormat;
  now: number;
  /** Shown before the menu: the thread's resolve button on its first comment. */
  actions?: ReactNode;
  /** Deleting the first comment deletes the thread. */
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bodyEditorRef = useRef<CommentBodyEditorHandle | null>(null);
  const when = useWhen(comment.timeStamp, rtf, now);
  const mine = comment.authorId === actions.me.id;
  const body = comment.body;
  // Only your own comments (the backend refuses other edits).
  const editable = mine && !comment.deleted && body !== null;
  const first = thread.comments[0]?.id === comment.id;

  return (
    <div className="group/comment">
      <div className="flex items-center gap-2">
        <CommentAvatar comment={comment} />
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="truncate text-[13px] font-semibold" title={comment.author}>
            {mine ? t.you : comment.author}
          </span>
          <span
            className="shrink-0 text-[11px] text-muted-foreground"
            title={new Date(comment.timeStamp).toLocaleString()}
          >
            {when}
            {comment.editedAt ? ` · ${t.commentEdited}` : ""}
          </span>
        </div>
        {rowActions}
        {!comment.deleted && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Comment actions"
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={stopPropagation}
              >
                <Ellipsis className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40" onClick={stopPropagation}>
              {editable ? (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} aria-hidden="true" />
                  {t.edit}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2 />
                {t.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <DeleteConfirm
        open={confirming}
        title={first ? t.deleteThreadConfirm : t.deleteCommentConfirm}
        onOpenChange={setConfirming}
        onDelete={onDelete}
      />
      {comment.deleted || body === null ? (
        <p className="mt-1 ps-8 text-[13px] text-muted-foreground italic">{t.deletedComment}</p>
      ) : editing ? (
        <div
          className="mt-2 ms-8 rounded-lg border border-input bg-background text-[13px] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10"
          onClick={stopPropagation}
        >
          <CommentBodyEditor
            ref={bodyEditorRef}
            autoFocus
            placeholder={t.typeComment}
            initialBody={body}
            onSubmit={(next) => {
              actions.edit(thread.id, comment.id, next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
          <div className="flex justify-end gap-1 border-t px-1.5 py-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
            <Button size="sm" onClick={() => bodyEditorRef.current?.submit()}>
              {t.save}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <HtmlView html={body.html} commentPreview className="mt-1 ps-8 text-[13px] leading-relaxed" />
          {!thread.resolved || comment.reactions.length ? <Reactions thread={thread} comment={comment} /> : null}
        </>
      )}
    </div>
  );
}

/** The thread's reply field: a rounded field with a send button, as a chat's. */
function ReplyComposer({
  thread,
  autoFocus,
  onCancel,
}: {
  thread: Thread;
  autoFocus?: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const bodyEditorRef = useRef<CommentBodyEditorHandle | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  return (
    <div
      className="mt-3 flex items-end gap-1 rounded-lg border border-input bg-background text-[13px] transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10"
      onClick={stopPropagation}
    >
      <div className="min-w-0 flex-1">
        <CommentBodyEditor
          ref={bodyEditorRef}
          autoFocus={autoFocus}
          placeholder={t.replyToComment}
          onSubmit={(body) => actions.reply(thread.id, body)}
          onCancel={onCancel}
          onEmptyChange={setIsEmpty}
        />
      </div>
      <Button
        variant={isEmpty ? "ghost" : "default"}
        size="icon"
        aria-label={t.comment}
        disabled={isEmpty}
        className="m-1 size-7 shrink-0 rounded-full"
        onClick={() => bodyEditorRef.current?.submit()}
      >
        <SendHorizontal className="size-3.5 rtl:rotate-180" />
      </Button>
    </div>
  );
}

function ThreadCard({
  editor,
  thread,
  state,
  active,
  dimmed,
  collapsed,
  canReply,
  rtf,
  now,
  onToggleCollapsed,
}: {
  editor: LexicalEditor;
  thread: Thread;
  state: CommentState;
  active: boolean;
  /** Another thread is picked: this one steps back, as in Google Docs. */
  dimmed: boolean;
  collapsed: boolean;
  canReply: boolean;
  rtf: Intl.RelativeTimeFormat;
  now: number;
  onToggleCollapsed: () => void;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const hoveredMarks = useRef(new Set<HTMLElement>());

  // Hovering the card lights up its text in the document.
  const hoverMarks = (on: boolean) => {
    const marks = hoveredMarks.current;
    for (const element of marks) element.classList.remove("hovered");
    marks.clear();
    if (!on) return;
    for (const key of state.markNodeMap.get(thread.id) ?? []) {
      const element = editor.getElementByKey(key);
      if (element) {
        element.classList.add("hovered");
        marks.add(element);
      }
    }
  };
  useEffect(() => {
    const marks = hoveredMarks.current;
    return () => {
      for (const element of marks) element.classList.remove("hovered");
    };
  }, []);

  // A thread picked in the document (its highlight clicked) comes into view.
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [active]);

  // The thread's highlight or media block, a fixed distance below the top of
  // the editor's visible area.
  const reveal = (nodeKey: NodeKey) => {
    const rootElement = editor.getRootElement();
    const element = editor.getElementByKey(nodeKey);
    if (rootElement && element) {
      revealInEditor(rootElement, element);
    }
  };

  const handleClickThread = () => {
    if (thread.anchorNodeKey) {
      const nodeKey = thread.anchorNodeKey;
      const activeElement = document.activeElement;
      editor.update(
        () => {
          if ($getNodeByKey(nodeKey)) {
            const selection = $createNodeSelection();
            selection.add(nodeKey);
            $setSelection(selection);
          }
        },
        {
          onUpdate() {
            reveal(nodeKey);
            editor.getRootElement()?.focus();
            if (activeElement instanceof HTMLElement) {
              activeElement.blur();
            }
          },
        },
      );
      return;
    }

    const markNodeKeys = state.markNodeMap.get(thread.id);
    if (markNodeKeys === undefined) {
      return;
    }
    const markNodeKey = Array.from(markNodeKeys)[0];
    // Already selected: only bring it back into view.
    if (active) {
      reveal(markNodeKey);
      return;
    }
    const activeElement = document.activeElement;
    editor.update(
      () => {
        const markNode = $getNodeByKey(markNodeKey);
        if ($isMarkNode(markNode)) {
          markNode.selectStart();
        }
      },
      {
        onUpdate() {
          reveal(markNodeKey);
          if (activeElement !== null) {
            (activeElement as HTMLElement).focus();
          }
        },
      },
    );
  };

  const deleteThread = () => {
    actions.deleteThread(thread.id);
    removeThreadMarks(editor, state, thread.id);
  };

  const [root, ...replies] = thread.comments;
  const hidden = expanded || replies.length <= 3 ? 0 : replies.length - 1;
  const shownReplies = hidden > 0 ? replies.slice(-1) : replies;
  const clickable = state.markNodeMap.has(thread.id) || Boolean(thread.anchorNodeKey);
  const people = [
    ...new Set(
      replies
        .filter((reply) => !reply.deleted)
        .map((reply) => (reply.authorId === actions.me.id ? t.you : reply.author)),
    ),
  ];
  // Text threads quote what they are on; media threads name the block.
  const quote = thread.anchor === "text" ? `“${thread.quote}”` : thread.quote;

  return (
    <article
      ref={cardRef}
      aria-current={active ? "true" : undefined}
      aria-label={thread.quote}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input, textarea, a, [role='menu'], [contenteditable='true']")) return;
        handleClickThread();
      }}
      onMouseEnter={() => hoverMarks(true)}
      onMouseLeave={() => hoverMarks(false)}
      className={cn(
        "group/thread relative scroll-my-3 rounded-xl border bg-card text-start transition-[box-shadow,opacity,border-color] duration-200",
        active
          ? "border-primary/60 shadow-md ring-3 ring-primary/10"
          : "hover:border-foreground/20 hover:shadow-sm",
        clickable && !active && "cursor-pointer",
        thread.resolved && !active && "bg-card/70",
        dimmed && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="flex items-start gap-1.5 px-3 pt-3">
        {/* Coloured like the highlight in the document, so the two read as a pair. */}
        <button
          type="button"
          title={thread.quote}
          className={cn(
            "min-w-0 flex-1 rounded-md px-2 py-1 text-start text-xs leading-snug transition-colors",
            thread.resolved
              ? "bg-muted text-muted-foreground line-through decoration-muted-foreground/40"
              : active
                ? "bg-amber-400/30 text-foreground"
                : "bg-amber-400/15 text-muted-foreground hover:text-foreground",
          )}
          onClick={(event) => {
            event.stopPropagation();
            handleClickThread();
          }}
        >
          <span className="line-clamp-2">{quote}</span>
        </button>
        {thread.resolved ? (
          <span className="mt-0.5 flex h-6 shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-3" aria-hidden="true" />
            Resolved
          </span>
        ) : null}
        <IconAction label={collapsed ? "Expand thread" : "Collapse thread"} onClick={onToggleCollapsed}>
          <ChevronDown className={cn("transition-transform", !collapsed && "rotate-180")} />
        </IconAction>
      </div>

      {collapsed || !root ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 pt-2 pb-3 text-start"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapsed();
          }}
        >
          {root ? <CommentAvatar comment={root} /> : null}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {root?.authorId === actions.me.id ? t.you : root?.author}
            </span>{" "}
            {root?.body?.text ?? ""}
          </span>
          {replies.length ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="px-3 pt-2.5 pb-3">
          <CommentRow
            comment={root}
            thread={thread}
            rtf={rtf}
            now={now}
            onDelete={deleteThread}
            actions={
              <IconAction
                label={thread.resolved ? t.reopen : t.resolve}
                className={
                  thread.resolved
                    ? "text-primary"
                    : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                }
                onClick={() => actions.setResolved(thread.id, !thread.resolved)}
              >
                {thread.resolved ? <RotateCcw /> : <Check />}
              </IconAction>
            }
          />
          {replies.length ? (
            <div className="mt-3 flex flex-col gap-3 border-t pt-3">
              {hidden > 0 ? (
                <button
                  type="button"
                  className="self-start rounded-sm ps-8 text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpanded(true);
                  }}
                >
                  {t.commentMoreReplies.replace("{count}", String(hidden))}
                </button>
              ) : null}
              {shownReplies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  thread={thread}
                  rtf={rtf}
                  now={now}
                  onDelete={() => actions.deleteComment(thread.id, reply.id)}
                />
              ))}
            </div>
          ) : null}
          {/* Like Google Docs: the reply field belongs to the thread in focus. */}
          {!thread.resolved && canReply ? (
            active || replying ? (
              <ReplyComposer thread={thread} autoFocus={replying} onCancel={() => setReplying(false)} />
            ) : (
              <button
                type="button"
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  setReplying(true);
                }}
              >
                Reply
                {people.length ? <span className="font-normal">· {people.slice(0, 3).join(", ")}</span> : null}
              </button>
            )
          ) : null}
        </div>
      )}
    </article>
  );
}

type CommentStatus = "open" | "resolved" | "all";
type CommentView = "all" | "for-you";
type CommentSort = "position" | "recent-activity" | "oldest";

function threadCreatedAt(thread: Thread) {
  return thread.comments[0]?.timeStamp ?? 0;
}

function threadUpdatedAt(thread: Thread) {
  return thread.comments[thread.comments.length - 1]?.timeStamp ?? 0;
}

function matchesSearch(thread: Thread, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    thread.quote,
    ...thread.comments.flatMap((comment) => [
      comment.author,
      comment.body?.text ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Threads that involve someone: they wrote in it or are @mentioned in it. */
export function isThreadForMe(thread: Thread, meId: string) {
  return thread.comments.some(
    (comment) =>
      !comment.deleted &&
      (comment.authorId === meId ||
        Boolean(comment.body?.html.includes(`data-entity-id="${meId}"`))),
  );
}

function matchesStatus(thread: Thread, status: CommentStatus) {
  if (status === "open") return !thread.resolved;
  if (status === "resolved") return thread.resolved;
  return true;
}

function $threadPositions() {
  const positions = new Map<string, number>();
  let index = 0;
  for (const { node } of $dfs()) {
    positions.set(`node:${node.getKey()}`, index);
    if ($isMarkNode(node)) {
      for (const id of node.getIDs()) {
        if (!positions.has(id)) {
          positions.set(id, index);
        }
      }
    }
    index += 1;
  }
  return positions;
}

/** Whether the editor has text selected (what a new comment would be on). */
function useHasTextSelection(editor: LexicalEditor) {
  const [hasSelection, setHasSelection] = useState(false);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        setHasSelection(
          editorState.read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) && !selection.isCollapsed();
          }),
        );
      }),
    [editor],
  );
  return hasSelection;
}

function CommentsEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="relative mb-3 flex size-12 items-center justify-center">
        <span className="absolute inset-0 rotate-6 rounded-2xl bg-primary/10" />
        <span className="relative flex size-12 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
          <MessageSquareText className="size-5" />
        </span>
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action ? (
        <Button type="button" size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The document's comment threads, laid out as Jaggle Office's comments
 * panel: a New comment card, All or For you with the status (and the order)
 * beside it, then a card per thread with its quote, comments and reply field.
 */
export function CommentsPanel({ onClose }: { onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const { t, language } = useTranslation();
  const isEditable = useLexicalEditable();
  const actions = useThreadActions();
  const state = useExtensionDependency(CommentExtension).output;
  const comments = useExtensionSignalValue(CommentExtension, "comments");
  const activeIDs = useExtensionSignalValue(CommentExtension, "activeIDs");
  const composing = useExtensionSignalValue(CommentExtension, "showCommentInput");
  const hasSelection = useHasTextSelection(editor);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<CommentView>("all");
  const [status, setStatus] = useState<CommentStatus>("open");
  const [sort, setSort] = useState<CommentSort>("position");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  // A new comment's field opens here while the panel is open.
  const slotRef = useCallback(
    (node: HTMLDivElement | null) => setComposerSlot(state, node),
    [state],
  );

  const closeSearch = () => {
    setSearching(false);
    setSearch("");
  };

  const rtf = useMemo(
    () =>
      new Intl.RelativeTimeFormat(language, {
        numeric: "auto",
        style: "short",
      }),
    [language],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const threads = useMemo(
    () => comments.filter((item): item is Thread => item.type === "thread"),
    [comments],
  );
  const openCount = threads.filter((thread) => !thread.resolved).length;
  const resolvedCount = threads.length - openCount;
  const byStatus = threads.filter((thread) => matchesStatus(thread, status));
  const allCount = byStatus.length;
  const forYouCount = byStatus.filter((thread) => isThreadForMe(thread, actions.me.id)).length;

  // A thread picked in the document shows even when the status hides it.
  const activeResolved = threads.some(
    (thread) => thread.resolved && activeIDs.includes(thread.id),
  );
  const [seenActiveResolved, setSeenActiveResolved] = useState(activeResolved);
  if (activeResolved !== seenActiveResolved) {
    setSeenActiveResolved(activeResolved);
    if (activeResolved && status === "open") setStatus("all");
  }
  // ...and expanded.
  const [seenActive, setSeenActive] = useState(activeIDs);
  if (activeIDs !== seenActive) {
    setSeenActive(activeIDs);
    if (collapsed.some((id) => activeIDs.includes(id))) {
      setCollapsed((current) => current.filter((id) => !activeIDs.includes(id)));
    }
  }

  const visible = useMemo(() => {
    const positions = editor.read(() => $threadPositions());
    return threads
      .filter((thread) => matchesStatus(thread, status))
      .filter((thread) => view === "all" || isThreadForMe(thread, actions.me.id))
      .filter((thread) => matchesSearch(thread, search))
      .sort((left, right) => {
        if (sort === "recent-activity") {
          return threadUpdatedAt(right) - threadUpdatedAt(left);
        }
        if (sort === "oldest") {
          return threadCreatedAt(left) - threadCreatedAt(right);
        }
        const leftPosition =
          positions.get(left.id) ??
          (left.anchorNodeKey
            ? positions.get(`node:${left.anchorNodeKey}`)
            : undefined) ??
          Number.MAX_VALUE;
        const rightPosition =
          positions.get(right.id) ??
          (right.anchorNodeKey
            ? positions.get(`node:${right.anchorNodeKey}`)
            : undefined) ??
          Number.MAX_VALUE;
        return leftPosition - rightPosition;
      });
  }, [actions.me.id, editor, search, sort, status, threads, view]);
  const hasActive = visible.some((thread) => activeIDs.includes(thread.id));

  let emptyTitle = t.noComments;
  let emptyDescription = isEditable
    ? "Select text, then add a comment to start a conversation."
    : "Comments people add will show here.";
  let emptyAction: { label: string; onClick: () => void } | undefined;
  if (search.trim()) {
    emptyTitle = `Nothing matches “${search.trim()}”`;
    emptyDescription = "Try other words, or a person’s name.";
    emptyAction = { label: "Clear search", onClick: closeSearch };
  } else if (view === "for-you") {
    emptyTitle = "Nothing for you right now";
    emptyDescription = "Comments you write, reply to, or are @mentioned in show here.";
    if (threads.length) emptyAction = { label: "See all comments", onClick: () => setView("all") };
  } else if (status === "open" && resolvedCount) {
    emptyTitle = "All caught up";
    emptyDescription = "Every comment in this document is resolved.";
    emptyAction = { label: `Show ${resolvedCount} resolved`, onClick: () => setStatus("resolved") };
  } else if (status === "resolved") {
    emptyTitle = "No resolved comments";
    emptyDescription = "Resolved threads show here, so you can reopen them.";
  }

  const statusLabel = status === "open" ? "Open" : status === "resolved" ? "Resolved" : "All";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/40">
      <div className="flex shrink-0 flex-col gap-3 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 ps-1">
          <h2 className="text-sm font-semibold">{t.comments}</h2>
          {openCount ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary tabular-nums">
              {openCount}
            </span>
          ) : null}
          <div className="flex-1" />
          <IconAction
            label={searching ? "Close comment search" : t.searchComments.replace(/\.+$/, "")}
            onClick={() => (searching ? closeSearch() : setSearching(true))}
          >
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </IconAction>
          <IconAction label="Close comments" onClick={onClose}>
            <X />
          </IconAction>
        </div>

        {searching ? (
          <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-card px-2.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              aria-label={t.searchComments}
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              placeholder="Search comments and people"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeSearch();
                }
              }}
            />
          </div>
        ) : null}

        {isEditable && !composing ? (
          <button
            type="button"
            disabled={!hasSelection}
            // Keeps the editor's selection, which the new comment is on.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.dispatchCommand(INSERT_INLINE_COMMAND, undefined)}
            className="group flex items-center gap-2.5 rounded-lg border border-dashed border-foreground/20 bg-card px-3 py-2.5 text-start transition-colors enabled:hover:border-primary enabled:hover:bg-primary/5 disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                hasSelection ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <MessageSquarePlus className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("text-[13px] font-medium", !hasSelection && "text-muted-foreground")}>
                {hasSelection ? "Add a comment" : "New comment"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {hasSelection ? "On your selection" : "Select text in the document to comment on it"}
              </span>
            </span>
          </button>
        ) : null}

        <div className="flex items-center gap-2">
          <div aria-label="Comment view" role="tablist" className="flex h-8 flex-1 gap-0.5 rounded-md bg-muted p-[2px]">
            {(
              [
                ["all", "All", allCount],
                ["for-you", "For you", forYouCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-sm text-xs transition-colors",
                  view === value
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView(value)}
              >
                {label}
                {count ? <span className="text-[11px] font-normal text-muted-foreground tabular-nums">{count}</span> : null}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Comment status"
                className="flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:border-foreground/20"
              >
                {statusLabel}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(
                [
                  ["open", "Open", openCount],
                  ["resolved", "Resolved", resolvedCount],
                  ["all", "All comments", threads.length],
                ] as const
              ).map(([value, label, count]) => (
                <DropdownMenuItem key={value} onSelect={() => setStatus(value)}>
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  {status === value ? <Check className="text-primary" /> : <span className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Order</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(value) => setSort(value as CommentSort)}>
                <DropdownMenuRadioItem value="position">Position in document</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="recent-activity">Recent activity</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-1 pb-4">
        <div ref={slotRef} className="contents" />
        {visible.length === 0 && !composing ? (
          <CommentsEmpty title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : null}
        {visible.map((thread) => {
          const active = activeIDs.includes(thread.id);
          return (
            <ThreadCard
              key={thread.id}
              editor={editor}
              thread={thread}
              state={state}
              active={active}
              dimmed={hasActive && !active}
              collapsed={collapsed.includes(thread.id)}
              canReply={isEditable}
              rtf={rtf}
              now={now}
              onToggleCollapsed={() =>
                setCollapsed((current) =>
                  current.includes(thread.id)
                    ? current.filter((id) => id !== thread.id)
                    : [...current, thread.id],
                )
              }
            />
          );
        })}
        {status === "open" && resolvedCount && visible.length ? (
          <button
            type="button"
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setStatus("resolved")}
          >
            <Check className="size-3.5" />
            {resolvedCount} resolved {resolvedCount === 1 ? "comment" : "comments"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Opens the comments panel when someone clicks commented text. The click puts
 * the caret in the highlight, which makes its thread the active one.
 */
export function CommentHighlightClickPlugin({ onOpen }: { onOpen: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerRootListener((root) => {
        if (!root) return;
        const onClick = (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("mark")) return;
          // A drag that selects text (to comment on it, say) is not a pick.
          if (window.getSelection()?.isCollapsed === false) return;
          const commented = editor.read(() => {
            for (let node = $getNearestNodeFromDOMNode(target); node; node = node.getParent()) {
              if ($isMarkNode(node)) return node.getIDs().length > 0;
            }
            return false;
          });
          if (commented) onOpen();
        };
        root.addEventListener("click", onClick);
        return () => root.removeEventListener("click", onClick);
      }),
    [editor, onOpen],
  );

  return null;
}

/** Time of the newest comment by someone else in an open thread (0 for none). */
export function useLatestCommentActivity(meId: string) {
  const comments = useExtensionSignalValue(CommentExtension, "comments");
  let latest = 0;
  for (const item of comments) {
    if (item.resolved) continue;
    for (const comment of item.comments) {
      if (!comment.deleted && comment.authorId !== meId && comment.timeStamp > latest) {
        latest = comment.timeStamp;
      }
    }
  }
  return latest;
}
