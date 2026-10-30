"use client";

import type { ReactNode } from "react";

import {
  AddSquareIcon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  CodeIcon,
  CommentAdd01Icon,
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  Edit02Icon,
  Image01Icon,
  LayoutTwoColumnIcon,
  Link01Icon,
  LinkSquare02Icon,
  PencilEdit01Icon,
  PlusSignIcon,
  RefreshIcon,
  RepeatIcon,
  SubtitleIcon,
  TableIcon,
  TextAlignCenterIcon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { getCodeLanguageOptions } from "@lexical/code-shiki";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
  type NodeKey,
} from "lexical";

import { useNotify } from "../../adapters/context";
import type { EditorNotify } from "../../adapters/types";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../ui/dropdown-menu";

import { useDocumentUi } from "../document/ui-context";
import { INSERT_INLINE_COMMAND, INSERT_MEDIA_COMMENT_COMMAND } from "../extensions/comment";
import {
  $addBoardColumn,
  $alignInParagraph,
  $blockInfo,
  $clearRating,
  $codeToParagraphs,
  $collapsibleToToggle,
  $deleteBlockNode,
  $duplicateBlock,
  $evenTableColumns,
  $headingToToggle,
  $insertSlashLine,
  $moveBlock,
  $pullQuoteToQuote,
  $quoteToPullQuote,
  $resetPollVotes,
  $setCodeLanguage,
  $setColumnLayout,
  $setEquationInline,
  $setOpen,
  $setToggleLevel,
  $toggleCaption,
  $toggleToCollapsible,
  $unwrapCard,
  $unwrapCollapsible,
  $unwrapColumns,
  $unwrapToggle,
  type BlockInfo,
  type BlockKind,
  COLUMN_LAYOUTS,
} from "../lib/block-actions";
import { BLOCK_VIEW_ACTION_COMMAND, type BlockViewAction } from "../lib/block-commands";
import { alignFromFormat } from "../lib/block-layout";
import { type Locale, useTranslation } from "../lib/locale";
import { applyDocumentBlock, type BlockId } from "../lib/slash-items";

/** Blocks whose comment highlights their text. */
const TEXT_KINDS = new Set<BlockKind>(["paragraph", "heading", "list", "quote", "code"]);
/** Blocks commented on as a whole, like media. Containers and dividers get no comment. */
const OBJECT_KINDS = new Set<BlockKind>([
  "image",
  "video",
  "audio",
  "file",
  "youtube",
  "tweet",
  "board",
  "poll",
  "review",
  "equation",
]);
const CAPTION_KINDS = new Set<BlockKind>(["image", "video", "audio", "file", "youtube", "tweet"]);
const FILE_KINDS = new Set<BlockKind>(["image", "video", "audio", "file"]);
/** Placed by their paragraph's alignment, so the menu offers Align. */
const PARAGRAPH_ALIGNED = new Set<BlockKind>(["image", "poll"]);

type TextTarget = {
  id: BlockId;
  label: "paragraph" | "heading1" | "heading2" | "heading3" | "bulletedListBlock" | "numberedListBlock" | "checkListBlock" | "quote" | "insertCodeBlock";
  kind: BlockKind;
  heading?: string;
  list?: string;
};

const TEXT_TARGETS: TextTarget[] = [
  { id: "paragraph", label: "paragraph", kind: "paragraph" },
  { id: "h1", label: "heading1", kind: "heading", heading: "h1" },
  { id: "h2", label: "heading2", kind: "heading", heading: "h2" },
  { id: "h3", label: "heading3", kind: "heading", heading: "h3" },
  { id: "bullet", label: "bulletedListBlock", kind: "list", list: "bullet" },
  { id: "number", label: "numberedListBlock", kind: "list", list: "number" },
  { id: "check", label: "checkListBlock", kind: "list", list: "check" },
  { id: "quote", label: "quote", kind: "quote" },
  { id: "code", label: "insertCodeBlock", kind: "code" },
];

/**
 * The text types a block may turn into, without its own type. A list keeps
 * to lists and paragraphs, a quote skips code (both would lose their
 * structure); code turns into paragraphs on its own path.
 */
function textTargets(info: BlockInfo): TextTarget[] {
  if (!TEXT_KINDS.has(info.kind) || info.kind === "code") return [];
  return TEXT_TARGETS.filter((target) => {
    if (info.kind === "list" && target.kind !== "list" && target.kind !== "paragraph") return false;
    if (info.kind === "quote" && target.kind === "code") return false;
    const current =
      target.kind === info.kind &&
      (target.heading === undefined || target.heading === info.headingTag) &&
      (target.list === undefined || target.list === info.listType);
    return !current;
  });
}

/** Selects all of a block's text, so Turn into and comments cover the whole block. */
function $selectBlockText(nodeKey: NodeKey) {
  const block = $getNodeByKey(nodeKey);
  if (!$isElementNode(block)) return;
  const first = block.getFirstDescendant();
  const last = block.getLastDescendant();
  if ($isTextNode(first) && $isTextNode(last)) {
    const selection = $createRangeSelection();
    selection.anchor.set(first.getKey(), 0, "text");
    selection.focus.set(last.getKey(), last.getTextContentSize(), "text");
    $setSelection(selection);
  } else {
    block.select(0, block.getChildrenSize());
  }
}

function copyText(notify: EditorNotify, text: string, done: string, failed: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => notify.success(done))
    .catch(() => notify.error(failed));
}

function nodeText(editor: LexicalEditor, nodeKey: NodeKey): string {
  return editor.getEditorState().read(() => $getNodeByKey(nodeKey)?.getTextContent() ?? "");
}

function Item({
  icon,
  label,
  onSelect,
  destructive,
}: {
  icon?: IconSvgElement;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem variant={destructive ? "destructive" : "default"} onSelect={onSelect}>
      {icon ? <HugeiconsIcon icon={icon} size={16} aria-hidden="true" /> : null}
      {label}
    </DropdownMenuItem>
  );
}

function SubTrigger({ icon, label }: { icon: IconSvgElement; label: string }) {
  return (
    <DropdownMenuSubTrigger>
      <HugeiconsIcon icon={icon} size={16} aria-hidden="true" />
      {label}
    </DropdownMenuSubTrigger>
  );
}

const ALIGN_LABEL: Record<"left" | "center" | "right", keyof Locale> = {
  left: "alignLeft",
  center: "alignCenter",
  right: "alignRight",
};

/**
 * The block menu, the same from the ⋮⋮ handle and from a block's ⋯: insert
 * above and below, the block's own options, Turn into where the content
 * carries over, then duplicate, move, comment and delete. Options that would
 * do nothing (the current type, moving the first block up) are left out.
 */
export function BlockMenuContent({
  nodeKey,
  label,
  align = "end",
}: {
  nodeKey: NodeKey;
  /** What a comment on a media-like block quotes; defaults to its text. */
  label?: string;
  align?: "start" | "end";
}) {
  const [editor] = useLexicalComposerContext();
  const { openComments, showComments } = useDocumentUi();
  const { t } = useTranslation();
  const toast = useNotify();
  // The committed state; `editor.read` would flush updates during render.
  const info = editor.getEditorState().read(() => $blockInfo(nodeKey));
  if (!info) return null;
  const { kind } = info;

  const run = (action: () => boolean, focus = false) => {
    editor.update(() => {
      action();
    });
    if (focus) requestAnimationFrame(() => editor.focus());
  };
  const view = (action: BlockViewAction) =>
    editor.dispatchCommand(BLOCK_VIEW_ACTION_COMMAND, { nodeKey, action });

  const turnInto: { key: string; label: string; onSelect: () => void }[] = textTargets(info).map(
    (target) => ({
      key: target.id,
      label: t[target.label],
      onSelect: () => {
        applyDocumentBlock(editor, target.id, () => $selectBlockText(nodeKey));
        requestAnimationFrame(() => editor.focus());
      },
    }),
  );
  if (kind === "code") {
    turnInto.push({ key: "paragraph", label: t.paragraph, onSelect: () => run(() => $codeToParagraphs(nodeKey)) });
  }
  if (kind === "heading" && info.headingTag && ["h1", "h2", "h3"].includes(info.headingTag)) {
    turnInto.push({ key: "toggle", label: t.blockToggleHeading, onSelect: () => run(() => $headingToToggle(nodeKey), true) });
  }
  if (kind === "quote") {
    turnInto.push({ key: "pullquote", label: t.insertPullQuote, onSelect: () => run(() => $quoteToPullQuote(nodeKey)) });
  }
  if (kind === "pullquote") {
    turnInto.push({ key: "quote", label: t.quote, onSelect: () => run(() => $pullQuoteToQuote(nodeKey)) });
  }
  if (kind === "toggle") {
    turnInto.push({ key: "collapsible", label: t.insertCollapsible, onSelect: () => run(() => $toggleToCollapsible(nodeKey)) });
  }
  if (kind === "collapsible") {
    turnInto.push({ key: "toggle", label: t.blockToggleList, onSelect: () => run(() => $collapsibleToToggle(nodeKey)) });
  }

  // Containers that can go away and leave their content where they were.
  const unwrap: Partial<Record<BlockKind, (key: NodeKey) => boolean>> = {
    toggle: $unwrapToggle,
    collapsible: $unwrapCollapsible,
    card: $unwrapCard,
    columns: $unwrapColumns,
  };
  const unwrapAction = unwrap[kind];

  const canComment = showComments && (TEXT_KINDS.has(kind) || OBJECT_KINDS.has(kind));
  const comment = () => {
    openComments();
    if (TEXT_KINDS.has(kind)) {
      editor.update(() => $selectBlockText(nodeKey));
      editor.dispatchCommand(INSERT_INLINE_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_MEDIA_COMMENT_COMMAND, { nodeKey, quote: label ?? info.quote });
    }
  };

  // Images are centered unless set otherwise; a poll follows the text (start).
  const currentAlign =
    kind === "image" ? alignFromFormat(info.align) : alignFromFormat(info.align || "left");
  const showAlign = PARAGRAPH_ALIGNED.has(kind);

  const ownOptions = [
    kind === "image" ? (
      <Item key="replace" icon={Image01Icon} label={t.blockReplace} onSelect={() => view("replace")} />
    ) : null,
    kind === "video" || kind === "audio" || kind === "file" ? (
      <Item key="replace" icon={RefreshIcon} label={t.blockReplace} onSelect={() => view("replace")} />
    ) : null,
    kind === "image" ? (
      <Item key="alt" icon={PencilEdit01Icon} label={t.blockAltText} onSelect={() => view("alt-text")} />
    ) : null,
    kind === "file" ? (
      <Item key="rename" icon={PencilEdit01Icon} label={t.renameFile} onSelect={() => view("rename")} />
    ) : null,
    FILE_KINDS.has(kind) ? (
      <Item key="download" icon={Download04Icon} label={t.downloadFile} onSelect={() => view("download")} />
    ) : null,
    kind === "youtube" || kind === "tweet" ? (
      <Item
        key="open"
        icon={LinkSquare02Icon}
        label={t.blockOpenOriginal}
        onSelect={() => {
          const url = nodeText(editor, nodeKey);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
      />
    ) : null,
    kind === "youtube" || kind === "tweet" ? (
      <Item
        key="copy-link"
        icon={Link01Icon}
        label={t.blockCopyLink}
        onSelect={() => copyText(toast, nodeText(editor, nodeKey), t.blockLinkCopied, t.blockLinkCopyFailed)}
      />
    ) : null,
    kind === "youtube" || kind === "tweet" ? (
      <Item key="change-link" icon={Edit02Icon} label={t.blockChangeLink} onSelect={() => view("edit")} />
    ) : null,
    CAPTION_KINDS.has(kind) ? (
      <Item
        key="caption"
        icon={SubtitleIcon}
        label={info.hasCaption ? t.blockRemoveCaption : t.blockAddCaption}
        onSelect={() => run(() => $toggleCaption(nodeKey))}
      />
    ) : null,
    kind === "equation" ? (
      <Item key="edit" icon={Edit02Icon} label={t.blockEditEquation} onSelect={() => view("edit")} />
    ) : null,
    kind === "equation" ? (
      <Item
        key="copy-latex"
        icon={Copy01Icon}
        label={t.blockCopyLatex}
        onSelect={() => copyText(toast, nodeText(editor, nodeKey), t.blockCopied, t.blockCopyFailed)}
      />
    ) : null,
    kind === "equation" ? (
      <Item
        key="inline"
        icon={RepeatIcon}
        label={info.inline ? t.blockShowAsBlock : t.blockShowInline}
        onSelect={() => run(() => $setEquationInline(nodeKey, !info.inline))}
      />
    ) : null,
    showAlign ? (
      <DropdownMenuSub key="align">
        <SubTrigger icon={TextAlignCenterIcon} label={t.blockAlign} />
        <DropdownMenuSubContent>
          {(["left", "center", "right"] as const).map((value) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={currentAlign === value}
              onCheckedChange={() => run(() => $alignInParagraph(nodeKey, value))}
            >
              {t[ALIGN_LABEL[value]]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : null,
    kind === "poll" && info.hasVotes ? (
      <Item key="reset" icon={RefreshIcon} label={t.blockResetVotes} onSelect={() => run(() => $resetPollVotes(nodeKey))} />
    ) : null,
    kind === "review" && info.rated ? (
      <Item key="clear" icon={RefreshIcon} label={t.blockClearRating} onSelect={() => run(() => $clearRating(nodeKey))} />
    ) : null,
    kind === "board" ? (
      <Item
        key="add-column"
        icon={AddSquareIcon}
        label={t.blockAddColumn}
        onSelect={() => run(() => $addBoardColumn(nodeKey, t.boardNewColumn))}
      />
    ) : null,
    kind === "table" ? (
      <Item key="even" icon={TableIcon} label={t.blockEvenColumns} onSelect={() => run(() => $evenTableColumns(nodeKey))} />
    ) : null,
    kind === "code" ? (
      <DropdownMenuSub key="language">
        <SubTrigger icon={CodeIcon} label={t.blockLanguage} />
        <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
          {getCodeLanguageOptions().map(([value, languageLabel]) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={info.language === value}
              onCheckedChange={() => run(() => $setCodeLanguage(nodeKey, value))}
            >
              {languageLabel}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : null,
    kind === "code" ? (
      <Item
        key="copy-code"
        icon={Copy01Icon}
        label={t.blockCopyCode}
        onSelect={() => copyText(toast, nodeText(editor, nodeKey), t.blockCopied, t.blockCopyFailed)}
      />
    ) : null,
    kind === "columns" ? (
      <DropdownMenuSub key="layout">
        <SubTrigger icon={LayoutTwoColumnIcon} label={t.blockColumnLayout} />
        <DropdownMenuSubContent className="w-52">
          {[2, 3, 4].map((count, index) => (
            <DropdownMenuGroupFor key={count} first={index === 0} label={t.blockColumnCount.replace("{count}", String(count))}>
              {COLUMN_LAYOUTS.filter((layout) => layout.count === count).map((layout) => (
                <DropdownMenuCheckboxItem
                  key={layout.template}
                  checked={info.columnTemplate === layout.template}
                  onCheckedChange={() => run(() => $setColumnLayout(nodeKey, layout.template))}
                >
                  {t[layout.label]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroupFor>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : null,
    kind === "toggle" || kind === "collapsible" ? (
      <Item
        key="open"
        icon={info.open ? UnfoldLessIcon : UnfoldMoreIcon}
        label={info.open ? t.blockCollapse : t.blockExpand}
        onSelect={() => run(() => $setOpen(nodeKey, !info.open))}
      />
    ) : null,
    kind === "toggle" && info.toggleVariant === "heading" ? (
      <DropdownMenuSub key="level">
        <SubTrigger icon={RepeatIcon} label={t.blockToggleLevel} />
        <DropdownMenuSubContent>
          {([1, 2, 3] as const).map((level) => (
            <DropdownMenuCheckboxItem
              key={level}
              checked={info.toggleLevel === level}
              onCheckedChange={() => run(() => $setToggleLevel(nodeKey, level))}
            >
              {t[level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3"]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : null,
  ].filter(Boolean);

  return (
    <DropdownMenuContent
      align={align}
      side="bottom"
      className="w-56"
      onCloseAutoFocus={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      <Item
        icon={PlusSignIcon}
        label={t.blockInsertAbove}
        onSelect={() => run(() => $insertSlashLine(nodeKey, "above"), true)}
      />
      <Item
        icon={PlusSignIcon}
        label={t.blockInsertBelow}
        onSelect={() => run(() => $insertSlashLine(nodeKey, "below"), true)}
      />
      {ownOptions.length > 0 || turnInto.length > 0 || unwrapAction ? <DropdownMenuSeparator /> : null}
      {ownOptions}
      {turnInto.length > 0 || unwrapAction ? (
        <DropdownMenuSub>
          <SubTrigger icon={RepeatIcon} label={t.blockTurnInto} />
          <DropdownMenuSubContent className="w-52">
            {turnInto.map((target) => (
              <DropdownMenuItem key={target.key} onSelect={target.onSelect}>
                {target.label}
              </DropdownMenuItem>
            ))}
            {unwrapAction ? (
              <>
                {turnInto.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onSelect={() => run(() => unwrapAction(nodeKey))}>
                  {t.blockUnwrap}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
      <DropdownMenuSeparator />
      {kind !== "divider" ? (
        <Item icon={Copy01Icon} label={t.blockDuplicate} onSelect={() => run(() => $duplicateBlock(nodeKey))} />
      ) : null}
      {info.canMoveUp ? (
        <Item icon={ArrowUp02Icon} label={t.blockMoveUp} onSelect={() => run(() => $moveBlock(nodeKey, "up"))} />
      ) : null}
      {info.canMoveDown ? (
        <Item icon={ArrowDown02Icon} label={t.blockMoveDown} onSelect={() => run(() => $moveBlock(nodeKey, "down"))} />
      ) : null}
      {canComment ? <Item icon={CommentAdd01Icon} label={t.addComment} onSelect={comment} /> : null}
      <DropdownMenuSeparator />
      <Item
        icon={Delete02Icon}
        label={t.delete}
        destructive
        onSelect={() => run(() => $deleteBlockNode(nodeKey))}
      />
    </DropdownMenuContent>
  );
}

function DropdownMenuGroupFor({
  first,
  label,
  children,
}: {
  first: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      {first ? null : <DropdownMenuSeparator />}
      <DropdownMenuLabel className="text-muted-foreground">{label}</DropdownMenuLabel>
      {children}
    </>
  );
}
