"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Cancel01Icon,
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
  ArrowDownUp,
  CheckCircle2,
  CircleDot,
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
  AlertDialogTrigger,
} from "../../../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/avatar";
import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { Input } from "../../../ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../../../ui/popover";
import { Tabs, TabsList, TabsTrigger } from "../../../ui/tabs";
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
  removeThreadMarks,
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
    if (mediaAnchor && triggerElem) {
      const anchorElement = editor.getElementByKey(mediaAnchor.nodeKey);
      if (anchorElement) {
        setFloatingAnchorRect(triggerElem, anchorElement.getBoundingClientRect());
        if (highlightsRef.current) {
          highlightsRef.current.innerHTML = "";
        }
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
      if (range === null || triggerElem === null || !rootElement || !parent) {
        return;
      }
      setFloatingAnchorRect(triggerElem, range.getBoundingClientRect());

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

function DeleteButton({
  title,
  onDelete,
  className,
}: {
  title: string;
  onDelete: () => void;
  className?: string;
}) {
  const { t, dir } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.delete}
          className={cn("size-6 text-muted-foreground", className)}
          onClick={(event) => event.stopPropagation()}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        dir={dir}
        onClick={(event) => event.stopPropagation()}
      >
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

function Reactions({ thread, comment }: { thread: Thread; comment: Comment }) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [open, setOpen] = useState(false);
  const toggle = (emoji: string) => actions.toggleReaction(thread.id, comment.id, emoji);

  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {comment.reactions.map((reaction) => {
        const mine = reaction.userIds.includes(actions.me.id);
        return (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={mine}
                onClick={() => toggle(reaction.emoji)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-2 text-sm tabular-nums transition-colors hover:bg-muted",
                  mine && "border-primary/40 bg-primary/10 hover:bg-primary/15",
                )}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                {reaction.userIds.length}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {reaction.names.filter(Boolean).join(", ") || reaction.emoji}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.commentAddReaction}
            className={cn(
              "size-6 rounded-full text-muted-foreground",
              comment.reactions.length === 0 &&
                "opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            )}
          >
            <HugeiconsIcon icon={SmileIcon} size={14} aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto gap-0.5 p-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted"
              onClick={() => {
                toggle(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CommentRow({
  comment,
  thread,
  rtf,
  now,
}: {
  comment: Comment;
  thread: Thread;
  rtf: Intl.RelativeTimeFormat;
  now: number;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [editing, setEditing] = useState(false);
  const bodyEditorRef = useRef<CommentBodyEditorHandle | null>(null);
  const minutes = Math.round((comment.timeStamp - now) / 60000);
  const hours = Math.round(minutes / 60);
  const when =
    minutes > -1
      ? t.justNow
      : minutes > -60
        ? rtf.format(minutes, "minute")
        : hours > -24
          ? rtf.format(hours, "hour")
          : rtf.format(Math.round(hours / 24), "day");
  const mine = comment.authorId === actions.me.id;
  const body = comment.body;
  // Only your own comments (the backend refuses other edits).
  const editable = mine && !comment.deleted && body !== null;

  return (
    <div className="group/comment flex gap-2.5">
      <Avatar className="mt-0.5 size-6 shrink-0">
        {comment.authorAvatar ? <AvatarImage src={comment.authorAvatar} alt="" /> : null}
        <AvatarFallback seed={comment.authorId || comment.author} className="text-[10px] font-semibold">
          {initials(comment.author)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-6 items-center gap-1.5">
          <span className="truncate font-medium">{mine ? t.you : comment.author}</span>
          <span
            className="shrink-0 text-sm text-muted-foreground"
            title={new Date(comment.timeStamp).toLocaleString()}
          >
            {when}
            {comment.editedAt ? ` · ${t.commentEdited}` : ""}
          </span>
          {!comment.deleted && !editing ? (
            <div className="ms-auto flex items-center opacity-0 group-hover/comment:opacity-100 focus-within:opacity-100">
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.edit}
                  className="size-6 text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(true);
                  }}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={14} aria-hidden="true" />
                </Button>
              ) : null}
              <DeleteButton
                title={t.deleteCommentConfirm}
                onDelete={() => actions.deleteComment(thread.id, comment.id)}
              />
            </div>
          ) : null}
        </div>
        {comment.deleted || body === null ? (
          <p className="text-muted-foreground italic">{t.deletedComment}</p>
        ) : editing ? (
          <div
            className="mt-1 rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
            onClick={(event) => event.stopPropagation()}
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
            <HtmlView html={body.html} commentPreview className="" />
            <Reactions thread={thread} comment={comment} />
          </>
        )}
      </div>
    </div>
  );
}

function ReplyComposer({ thread }: { thread: Thread }) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const bodyEditorRef = useRef<CommentBodyEditorHandle | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  return (
    <div
      className="mt-3 flex items-end gap-1 rounded-md border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        <CommentBodyEditor
          ref={bodyEditorRef}
          placeholder={t.replyToComment}
          onSubmit={(body) => actions.reply(thread.id, body)}
          onEmptyChange={setIsEmpty}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.comment}
        disabled={isEmpty}
        className="m-0.5 size-7 shrink-0"
        onClick={() => bodyEditorRef.current?.submit()}
      >
        <SendHorizontal className="rtl:rotate-180" />
      </Button>
    </div>
  );
}

function ThreadCard({
  editor,
  thread,
  state,
  active,
  rtf,
  now,
}: {
  editor: LexicalEditor;
  thread: Thread;
  state: CommentState;
  active: boolean;
  rtf: Intl.RelativeTimeFormat;
  now: number;
}) {
  const { t } = useTranslation();
  const actions = useThreadActions();
  const [expanded, setExpanded] = useState(false);

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

  const comments = thread.comments;
  const hidden = expanded || comments.length <= 3 ? 0 : comments.length - 2;
  const shown = hidden > 0 ? [comments[0], comments[comments.length - 1]] : comments;

  return (
    <div
      onClick={handleClickThread}
      className={cn(
        "group/thread rounded-lg border bg-card p-3 text-start transition-colors",
        (state.markNodeMap.has(thread.id) || thread.anchorNodeKey) &&
          "cursor-pointer hover:border-foreground/15",
        active && "border-primary/40 ring-2 ring-primary/15 hover:border-primary/40",
        thread.resolved && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Styled like the highlight in the document, so the two read as a pair. */}
        <blockquote className="line-clamp-2 min-w-0 flex-1 border-s-2 border-amber-400 ps-2 text-sm text-muted-foreground">
          {thread.quote}
        </blockquote>
        <div
          className={cn(
            "-mt-1 -me-1 flex shrink-0 items-center opacity-0 transition-opacity group-hover/thread:opacity-100 focus-within:opacity-100",
            active && "opacity-100",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={thread.resolved ? t.reopen : t.resolve}
                className="size-7 text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  actions.setResolved(thread.id, !thread.resolved);
                }}
              >
                {thread.resolved ? <CircleDot /> : <CheckCircle2 />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {thread.resolved ? t.reopen : t.resolve}
            </TooltipContent>
          </Tooltip>
          <DeleteButton
            title={t.deleteThreadConfirm}
            className="size-7 shrink-0"
            onDelete={() => {
              actions.deleteThread(thread.id);
              removeThreadMarks(editor, state, thread.id);
            }}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {shown.map((comment, index) => (
          <div key={comment.id} className="contents">
            {hidden > 0 && index === 1 ? (
              <button
                type="button"
                className="ms-8.5 self-start rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded(true);
                }}
              >
                {t.commentMoreReplies.replace("{count}", String(hidden))}
              </button>
            ) : null}
            <CommentRow comment={comment} thread={thread} rtf={rtf} now={now} />
          </div>
        ))}
      </div>
      {/* Like Google Docs: the reply field belongs to the thread in focus. */}
      {active && !thread.resolved ? (
        <ReplyComposer thread={thread} />
      ) : null}
    </div>
  );
}

type CommentFilter = "all" | "open" | "resolved";
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

export function CommentsPanel({ onClose }: { onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const { t, language } = useTranslation();
  const state = useExtensionDependency(CommentExtension).output;
  const comments = useExtensionSignalValue(CommentExtension, "comments");
  const activeIDs = useExtensionSignalValue(CommentExtension, "activeIDs");
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<CommentFilter>("open");
  const [sort, setSort] = useState<CommentSort>("position");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

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

  const counts = useMemo(
    () => ({
      total: threads.length,
      open: threads.filter((thread) => !thread.resolved).length,
      resolved: threads.filter((thread) => thread.resolved).length,
    }),
    [threads],
  );

  const visible = useMemo(() => {
    const positions = editor.read(() => $threadPositions());
    return threads
      .filter((thread) => {
        if (filter === "open") return !thread.resolved;
        if (filter === "resolved") return thread.resolved;
        return true;
      })
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
  }, [editor, filter, search, sort, threads]);

  const filters = [
    { value: "all" as const, label: "All", count: counts.total },
    { value: "open" as const, label: "Open", count: counts.open },
    { value: "resolved" as const, label: "Resolved", count: counts.resolved },
  ];

  let emptyTitle = t.noComments;
  let emptyDescription =
    "Select text or a media block and add a comment to start a discussion.";
  if (search.trim()) {
    emptyTitle = "No matching comments";
    emptyDescription = "Try a different search term.";
  } else if (threads.length > 0 && filter === "open") {
    emptyTitle = "No open comments";
    emptyDescription = "All comment threads have been resolved.";
  } else if (threads.length > 0 && filter === "resolved") {
    emptyTitle = "No resolved comments";
    emptyDescription = "No threads have been resolved yet.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 ps-3.5 pe-2">
        {searching ? (
          <>
            <div className="min-w-0 flex-1">
              <Input
                usage="search"
                variant="minimal"
                autoFocus
                placeholder={t.searchComments}
                aria-label={t.searchComments}
                onSearchChange={setSearch}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeSearch();
                  }
                }}
                className="h-7"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              aria-label="Close search"
              onClick={closeSearch}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <p className="font-medium">{t.comments}</p>
            {counts.total > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary tabular-nums">
                {counts.total}
              </span>
            ) : null}
            <div className="ms-auto flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground"
                    aria-label={t.searchComments}
                    onClick={() => setSearching(true)}
                  >
                    <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.searchComments}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "size-6 text-muted-foreground",
                          sort !== "position" && "text-primary",
                        )}
                        aria-label="Sort comments"
                      >
                        <ArrowDownUp className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Sort</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="min-w-36">
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(value) => setSort(value as CommentSort)}
                  >
                    <DropdownMenuRadioItem value="position">Position</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="recent-activity">Recent activity</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground"
                aria-label="Close comments"
                onClick={onClose}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as CommentFilter)}
        className="gap-0"
      >
        <TabsList className="h-8 w-full gap-0 px-1.5">
          {filters.map(({ value, label, count }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-8 min-w-0 flex-1 gap-1 px-2 py-0 text-sm"
            >
              {label}
              {count > 0 ? (
                <span className="tabular-nums text-muted-foreground">
                  {count}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="mb-1 font-medium">{emptyTitle}</p>
            <p className="text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((thread) => (
              <ThreadCard
                key={thread.id}
                editor={editor}
                thread={thread}
                state={state}
                active={activeIDs.includes(thread.id)}
                rtf={rtf}
                now={now}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
