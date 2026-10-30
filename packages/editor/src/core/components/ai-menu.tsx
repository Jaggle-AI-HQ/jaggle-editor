"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircleIcon,
  RefreshIcon,
  StopCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { IS_APPLE, markSelection } from "@lexical/utils";
import { HISTORY_PUSH_TAG, UNDO_COMMAND } from "lexical";
import {
  FileText,
  Languages,
  Lightbulb,
  ListChecks,
  ListCollapse,
  Pencil,
  Plus,
  Quote,
  Search,
  Smile,
  Sparkles,
  SpellCheck,
  Table,
  Type,
  type LucideIcon,
} from "lucide-react";

import { useEditorAdapters, useNotify } from "../../adapters/context";
import { Loader } from "../../ui/loader";
import { Button } from "../../ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../ui/popover";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../lib/utils";
import type { CreditShortfall, DocumentAiMode } from "../../adapters/types";

import type { AnchorPoint } from "../document/ui-context";
import {
  $applyAiResult,
  $buildDocumentAiRequest,
  $lossyReplaceLabels,
  $readAiTarget,
  AI_ACTIONS,
  AI_MAX_PROMPT_LENGTH,
  type AiActionGroup,
  type AiActionKey,
  type AiPlacement,
  placementForMode,
} from "../lib/ai";
import { type Locale, useTranslation } from "../lib/locale";
import { useFloatingCollisionBoundary } from "../plugins/floating/floating-utils";

import { AiPreview, useAiPreviewHtml } from "./ai-preview";

type LocaleKey = { [K in keyof Locale]: Locale[K] extends string ? K : never }[keyof Locale];

const AI_ITEMS: { key: AiActionKey; label: LocaleKey; icon: LucideIcon }[] = [
  { key: "improve_writing", label: "aiImproveWriting", icon: Type },
  { key: "fix_spelling", label: "aiFixSpelling", icon: SpellCheck },
  { key: "translate_content", label: "aiTranslate", icon: Languages },
  { key: "simplify_content", label: "aiSimplify", icon: Type },
  { key: "make_informal", label: "aiMakeInformal", icon: Smile },
  { key: "summarize_content", label: "aiSummarize", icon: ListCollapse },
  { key: "expand_content", label: "aiExpand", icon: Plus },
  { key: "expand_with_research", label: "aiExpandWithResearch", icon: Search },
  { key: "add_citations", label: "aiAddCitations", icon: Quote },
  { key: "generate_table", label: "aiGenerateTable", icon: Table },
  { key: "creative_storytelling", label: "aiCreativeStory", icon: Sparkles },
  { key: "continue_with_ai", label: "aiContinueWriting", icon: Pencil },
  { key: "generate_ideas", label: "aiBrainstorm", icon: Lightbulb },
  { key: "add_related_topics", label: "aiAddRelatedTopics", icon: Plus },
  { key: "executive_summary", label: "aiExecutiveSummary", icon: FileText },
  { key: "extract_action_items", label: "aiExtractActionItems", icon: ListChecks },
];

const GROUP_LABELS: Record<AiActionGroup, LocaleKey> = {
  edit: "aiGroupEdit",
  write: "aiGroupWrite",
  document: "aiGroupDocument",
};

const PLACEMENT_LABELS: Record<AiPlacement, { action: LocaleKey; hint: LocaleKey }> = {
  replace: { action: "aiReplace", hint: "aiPlacesReplace" },
  below: { action: "aiInsertBelow", hint: "aiPlacesBelow" },
  top: { action: "aiAddToTop", hint: "aiPlacesTop" },
  end: { action: "aiAddToEnd", hint: "aiPlacesEnd" },
};

const MAX_PROMPT_HEIGHT = 100;
/** How often the preview re-renders while the result streams in. */
const STREAM_RENDER_MS = 120;
const SELECTION_TINT = "color-mix(in oklab, var(--primary) 22%, transparent)";

type AiRun = {
  actionKey: string;
  /** What the result view's header shows: the action name or the typed prompt. */
  label: string;
  prompt: string;
  mode: DocumentAiMode;
};

type AiPhase =
  | { kind: "input" }
  | { kind: "streaming"; run: AiRun; html: string }
  | { kind: "review"; run: AiRun; text: string; html: string }
  | { kind: "error"; run: AiRun; message: string };

const noShortfall = (): CreditShortfall | null => null;

/** An HTTP status on a rejected AI run (402 out of credits, 429 rate limited). */
function errorStatus(error: unknown): { status?: number; body?: unknown } {
  return error && typeof error === "object" && "status" in error
    ? (error as { status?: number; body?: unknown })
    : {};
}

export function AiMenu({
  anchor,
  workspaceId,
  onClose,
}: {
  anchor: AnchorPoint;
  workspaceId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  // What the AI works on is fixed when the menu opens.
  const [target] = useState(() => editor.read($readAiTarget));
  const hasSelection = target.selection !== null;
  // Blocks and marks Markdown cannot carry; Replace would drop them.
  const [lossy] = useState(() => editor.read(() => $lossyReplaceLabels(target)));
  const toHtml = useAiPreviewHtml();
  const { ai } = useEditorAdapters();
  const toast = useNotify();
  // The app's credit check, a hook; the same one on every render.
  const useShortfall = ai?.credits?.useShortfall ?? noShortfall;
  const shortfall = useShortfall(workspaceId);
  const usageHref =
    workspaceId && ai?.credits?.usageHref ? ai.credits.usageHref(workspaceId) : undefined;
  const CreditBadge = ai?.credits?.Badge;

  const [prompt, setPrompt] = useState("");
  const [prefillKey, setPrefillKey] = useState<AiActionKey | null>(null);
  const [phase, setPhase] = useState<AiPhase>({ kind: "input" });
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<{ run: AiRun; text: string } | null>(null);

  // The prompt takes focus, so the selection would vanish; keep it visible as
  // the text Replace overwrites.
  useEffect(() => {
    if (!hasSelection) {
      return;
    }
    return markSelection(editor, (nodes) => {
      for (const node of nodes) {
        node.style.background = SELECTION_TINT;
        node.style.pointerEvents = "none";
      }
    });
  }, [editor, hasSelection]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useLayoutEffect(() => {
    const input = promptInputRef.current;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_PROMPT_HEIGHT)}px`;
  }, [prompt, phase.kind]);

  // Follow the text as it streams in.
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (phase.kind === "streaming" && preview) {
      preview.scrollTop = preview.scrollHeight;
    }
  }, [phase]);

  useEffect(() => {
    if (phase.kind === "review") {
      primaryRef.current?.focus();
    }
  }, [phase.kind]);

  const showShortfallToast = ({ required, available, resetDate }: CreditShortfall) => {
    const reset = resetDate
      ? new Date(resetDate)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    toast.error(
      `Insufficient AI credits: ${required} required, ${available} available`,
      {
        description: `Credits reset on ${reset.toLocaleDateString()}`,
        action: usageHref
          ? {
              label: t.aiViewUsage,
              onClick: () => window.location.assign(usageHref),
            }
          : undefined,
      },
    );
  };

  const start = (run: AiRun) => {
    if (!ai) {
      return;
    }
    if (shortfall) {
      showShortfallToast(shortfall);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    streamRef.current = { run, text: "" };
    setPhase({ kind: "streaming", run, html: "" });

    const request = editor.read(() =>
      $buildDocumentAiRequest(target, {
        workspaceId: workspaceId ?? "",
        userPrompt: run.prompt,
        actionKey: run.actionKey,
        mode: run.mode,
      }),
    );

    let renderTimer: ReturnType<typeof setTimeout> | null = null;
    const render = () => {
      renderTimer = null;
      if (!controller.signal.aborted && streamRef.current) {
        setPhase({ kind: "streaming", run, html: toHtml(streamRef.current.text) });
      }
    };
    const settle = (next: AiPhase) => {
      if (renderTimer) {
        clearTimeout(renderTimer);
      }
      if (!controller.signal.aborted) {
        abortRef.current = null;
        streamRef.current = null;
        setPhase(next);
      }
    };

    ai.stream(request, {
      signal: controller.signal,
      onText: (text) => {
        if (streamRef.current) {
          streamRef.current.text = text;
        }
        renderTimer ??= setTimeout(render, STREAM_RENDER_MS);
      },
    }).then(
      (text) =>
        settle(
          text.trim()
            ? { kind: "review", run, text, html: toHtml(text) }
            : { kind: "error", run, message: t.aiEmptyResult },
        ),
      (error: unknown) => {
        const { status, body: errorBody } = errorStatus(error);
        if (status === 402) {
          const body =
            errorBody && typeof errorBody === "object"
              ? (errorBody as { required?: unknown; available?: unknown; reset_date?: unknown })
              : {};
          showShortfallToast({
            required: Number(body.required ?? 0),
            available: Number(body.available ?? 0),
            resetDate: typeof body.reset_date === "string" ? body.reset_date : undefined,
          });
          settle({ kind: "input" });
          return;
        }
        if (status === 429) {
          toast.error(t.aiRateLimited);
          settle({ kind: "input" });
          return;
        }
        settle({ kind: "error", run, message: t.aiFailed });
      },
    );
  };

  /** Stops the stream; whatever arrived can still be applied. */
  const stop = () => {
    const current = streamRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    streamRef.current = null;
    setPhase(
      current?.text.trim()
        ? { kind: "review", run: current.run, text: current.text, html: toHtml(current.text) }
        : { kind: "input" },
    );
  };

  // A click outside while AI is writing would throw the writing away, so it
  // only points at Stop instead (briefly).
  const [closeBlocked, setCloseBlocked] = useState(false);
  const closeBlockedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeBlockedTimerRef.current), []);
  const blockCloseWhileWriting = (event: Event) => {
    if (phase.kind !== "streaming") return;
    event.preventDefault();
    setCloseBlocked(true);
    clearTimeout(closeBlockedTimerRef.current);
    closeBlockedTimerRef.current = setTimeout(() => setCloseBlocked(false), 3000);
  };
  useEffect(() => {
    if (phase.kind !== "streaming") setCloseBlocked(false);
  }, [phase.kind]);

  const close = (refocusEditor: boolean) => {
    onClose();
    if (refocusEditor) {
      // Back to where the user was, with the selection they had.
      editor.focus();
    }
  };

  const apply = (placement: AiPlacement) => {
    if (phase.kind !== "review") {
      return;
    }
    const { text } = phase;
    // One history entry, so a single undo removes the whole result.
    editor.update(() => $applyAiResult(text, placement, target), {
      tag: HISTORY_PUSH_TAG,
    });
    toast.success(t.aiApplied, {
      action: {
        label: t.undo,
        onClick: () => editor.dispatchCommand(UNDO_COMMAND, undefined),
      },
    });
    close(true);
  };

  const submitPrompt = () => {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    start({
      actionKey: prefillKey ?? "manual",
      label: text,
      prompt: text,
      mode: prefillKey
        ? AI_ACTIONS[prefillKey].mode
        : hasSelection
          ? "replace-selection"
          : "insert-after-cursor",
    });
  };

  const runItem = (item: (typeof AI_ITEMS)[number]) => {
    const action = AI_ACTIONS[item.key];
    if (action.prefill) {
      setPrompt(action.prompt);
      setPrefillKey(item.key);
      requestAnimationFrame(() => {
        const input = promptInputRef.current;
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      });
      return;
    }
    start({
      actionKey: item.key,
      label: t[item.label],
      prompt: action.prompt,
      mode: action.mode,
    });
  };

  const focusItem = (step: 1 | -1) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const index = items.findIndex((item) => item === document.activeElement);
    const next = index + step;
    if (next < 0) {
      promptInputRef.current?.focus();
    } else {
      items[Math.min(next, items.length - 1)]?.focus();
    }
  };

  const onPromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitPrompt();
    } else if (
      event.key === "ArrowDown" &&
      event.currentTarget.selectionStart === event.currentTarget.value.length
    ) {
      event.preventDefault();
      focusItem(1);
    }
  };

  const groups = (["edit", "write", "document"] as const)
    .filter((group) => (group === "edit") === hasSelection)
    .map((group) => ({
      group,
      items: AI_ITEMS.filter((item) => AI_ACTIONS[item.key].group === group),
    }));

  const placement =
    phase.kind === "input" ? null : placementForMode(phase.run.mode, hasSelection);
  // When Replace would lose content, Insert below leads and Replace stays one click away.
  const guarded = placement === "replace" && lossy.length > 0;
  const primary: AiPlacement | null = guarded ? "below" : placement;
  const secondary: AiPlacement | null =
    placement === "replace" ? (guarded ? "replace" : "below") : null;
  const hint = guarded
    ? t.aiReplaceRemoves.replace(
        "{items}",
        new Intl.ListFormat("en", { type: "conjunction" }).format(lossy),
      )
    : placement
      ? t[PLACEMENT_LABELS[placement].hint]
      : null;
  const shortcut = IS_APPLE ? "⌘↵" : "Ctrl+↵";

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 size-px opacity-0"
        style={{ transform: `translate(${anchor.left}px, ${anchor.top}px)` }}
      />
      <PopoverContent
        role="dialog"
        aria-label={t.askAi}
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        hideWhenDetached
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={blockCloseWhileWriting}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (phase.kind === "streaming") {
            stop();
          } else {
            close(true);
          }
        }}
        onKeyDown={(event) => {
          if (
            phase.kind === "review" &&
            primary &&
            event.key === "Enter" &&
            (IS_APPLE ? event.metaKey : event.ctrlKey)
          ) {
            event.preventDefault();
            apply(primary);
          }
        }}
        className="flex max-w-(--radix-popper-available-width) w-[min(92vw,40rem)] flex-col overflow-hidden bg-card p-0 text-card-foreground"
        onMouseDown={(event) => {
          if (
            phase.kind === "input" &&
            event.target instanceof Element &&
            event.target.closest("button")
          ) {
            event.preventDefault();
          }
        }}
      >
        {phase.kind === "input" ? (
          <>
            <div className="flex shrink-0 items-start gap-3 px-4 py-2">
              <span className="flex w-8 h-10 shrink-0 items-center justify-center text-muted-foreground">
                <Sparkles className="size-4" />
              </span>
              <Textarea
                ref={promptInputRef}
                autoFocus
                rows={1}
                value={prompt}
                maxLength={AI_MAX_PROMPT_LENGTH}
                aria-label={t.askAi}
                placeholder={
                  hasSelection ? t.askAiEditPlaceholder : t.askAiWritePlaceholder
                }
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (!event.target.value.trim()) {
                    setPrefillKey(null);
                  }
                }}
                onKeyDown={onPromptKeyDown}
                style={{
                  fieldSizing: "fixed",
                  maxHeight: MAX_PROMPT_HEIGHT,
                }}
                className="min-h-10 min-w-0 w-auto flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-1.5 leading-7 outline-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>

            <div className="mx-2 h-px shrink-0 bg-border" />

            <div
              ref={listRef}
              className="max-h-64 shrink-0 overflow-y-auto overscroll-contain p-2"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  focusItem(event.key === "ArrowDown" ? 1 : -1);
                }
              }}
            >
              {groups.map(({ group, items }) => (
                <div
                  key={group}
                  role="group"
                  aria-label={t[GROUP_LABELS[group]]}
                  className="grid gap-0 not-first:mt-1"
                >
                  <p className="px-2 py-1.5 font-medium text-muted-foreground">
                    {t[GROUP_LABELS[group]]}
                  </p>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={shortfall !== null}
                        aria-pressed={prefillKey === item.key}
                        className="flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted"
                        onClick={() => runItem(item)}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center text-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t[item.label]}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2">
              {shortfall ? (
                <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-destructive">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {t.aiNoCredits} ({shortfall.available}/{shortfall.required})
                  </span>
                  {usageHref ? (
                    <a
                      href={usageHref}
                      className="shrink-0 underline underline-offset-2"
                    >
                      {t.aiViewUsage}
                    </a>
                  ) : null}
                </p>
              ) : (
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {t.aiRunHint}
                </p>
              )}
              {workspaceId && CreditBadge ? (
                <CreditBadge workspaceId={workspaceId} className="hidden shrink-0 sm:inline-flex" />
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                disabled={!prompt.trim() || shortfall !== null}
                onClick={submitPrompt}
              >
                {t.aiRun}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {phase.run.label}
              </span>
              {phase.kind === "streaming" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 shrink-0 transition-shadow",
                    closeBlocked && "ring-2 ring-amber-500/60",
                  )}
                  onClick={stop}
                >
                  <HugeiconsIcon icon={StopCircleIcon} className="size-4" />
                  {t.aiStop}
                </Button>
              ) : null}
            </div>

            <div
              ref={previewRef}
              aria-live="polite"
              aria-busy={phase.kind === "streaming"}
              className="max-h-[min(50vh,24rem)] min-h-16 overflow-y-auto overscroll-contain px-4 py-3"
            >
              {phase.kind === "error" ? (
                <p className="flex items-start gap-2 text-destructive">
                  <HugeiconsIcon icon={AlertCircleIcon} className="mt-1 size-4 shrink-0" />
                  <span>{phase.message}</span>
                </p>
              ) : phase.html ? (
                <AiPreview html={phase.html} />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader className="text-[6px]" />
                  <span>{t.aiThinking}</span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-2">
              <p
                role={closeBlocked ? "status" : undefined}
                className={cn(
                  "min-w-0 flex-1 text-xs",
                  // The warning gets its own row so it is read in full.
                  guarded || closeBlocked
                    ? "basis-full text-amber-700 dark:text-amber-400"
                    : "basis-40 truncate text-muted-foreground",
                )}
              >
                {closeBlocked ? t.aiStopBeforeClosing : hint}
              </p>
              {phase.kind !== "streaming" ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => close(true)}
                  >
                    {t.aiDiscard}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    disabled={shortfall !== null}
                    onClick={() => start(phase.run)}
                  >
                    <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                    {t.aiTryAgain}
                  </Button>
                </>
              ) : null}
              {phase.kind === "review" && secondary ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => apply(secondary)}
                >
                  {t[PLACEMENT_LABELS[secondary].action]}
                </Button>
              ) : null}
              {phase.kind === "review" && primary ? (
                <Button
                  ref={primaryRef}
                  type="button"
                  size="sm"
                  className="h-8"
                  aria-keyshortcuts={IS_APPLE ? "Meta+Enter" : "Control+Enter"}
                  onClick={() => apply(primary)}
                >
                  {t[PLACEMENT_LABELS[primary].action]}
                  <kbd className="text-xs opacity-70">{shortcut}</kbd>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
