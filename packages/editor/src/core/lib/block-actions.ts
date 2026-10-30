import type { CodeNode } from "@lexical/code";
import type { ListNode } from "@lexical/list";
import { $isMarkNode } from "@lexical/mark";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import type { TableNode } from "@lexical/table";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getEditor,
  $getNodeByKey,
  $getSlot,
  $isElementNode,
  $isParagraphNode,
  $parseSerializedNode,
  type ElementFormatType,
  type ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";

import type { BoardNode } from "../nodes/board-node";
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  type CollapsibleContainerNode,
} from "../nodes/collapsible-node";
import type { EquationNode } from "../nodes/equation-node";
import {
  $createLayoutItemNode,
  type LayoutContainerNode,
} from "../nodes/layout-node";
import type { PollNode } from "../nodes/poll-node";
import { $createPullQuoteNode } from "../nodes/pullquote-node";
import type { ReviewNode } from "../nodes/review-node";
import { $createSlotContainerNode } from "../nodes/slot-container-node";
import {
  $createToggleContentNode,
  $createToggleNode,
  $createToggleTitleNode,
  type ToggleLevel,
  type ToggleNode,
} from "../nodes/toggle-node";

import { createBoardColumn } from "./board";
import { measureColumnWidths } from "./table-widths";

/**
 * Block-level actions for the block menu (the ⋮⋮ handle and the ⋯ button on
 * media). A "block" is the top-level node holding the target: the node itself
 * for block nodes, the paragraph for an inline image, poll or equation.
 *
 * Kinds are told apart by node type name, so this file does not import the
 * node modules that render block menus (which would be a cycle).
 */

export type BlockKind =
  | "paragraph"
  | "heading"
  | "list"
  | "quote"
  | "code"
  | "toggle"
  | "collapsible"
  | "card"
  | "pullquote"
  | "columns"
  | "table"
  | "board"
  | "poll"
  | "review"
  | "equation"
  | "divider"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "youtube"
  | "tweet"
  | "other";

const KIND_BY_TYPE: Record<string, BlockKind> = {
  paragraph: "paragraph",
  heading: "heading",
  list: "list",
  quote: "quote",
  code: "code",
  toggle: "toggle",
  "collapsible-container": "collapsible",
  card: "card",
  pullquote: "pullquote",
  "layout-container": "columns",
  table: "table",
  board: "board",
  poll: "poll",
  review: "review",
  equation: "equation",
  horizontalrule: "divider",
  image: "image",
  video: "video",
  audio: "audio",
  file: "file",
  youtube: "youtube",
  tweet: "tweet",
};

/** Inline blocks that sit alone in a paragraph and are the block's real subject. */
const LONE_INLINE_KINDS = new Set<BlockKind>(["image", "poll", "equation"]);

export type BlockInfo = {
  kind: BlockKind;
  /** The node the menu acts on (the image, not its paragraph). */
  nodeKey: NodeKey;
  canMoveUp: boolean;
  canMoveDown: boolean;
  headingTag?: HeadingTagType;
  listType?: "bullet" | "number" | "check";
  toggleVariant?: "heading" | "list";
  toggleLevel?: ToggleLevel;
  open?: boolean;
  columnTemplate?: string;
  columnCount?: number;
  language?: string;
  hasVotes?: boolean;
  rated?: boolean;
  inline?: boolean;
  /** For blocks placed by their paragraph (image, poll, equation). */
  align?: ElementFormatType;
  hasCaption?: boolean;
  /** Text a comment on the block quotes. */
  quote: string;
};

export function $blockOf(node: LexicalNode): LexicalNode {
  return node.getTopLevelElement() ?? node;
}

function $blockByKey(nodeKey: NodeKey): LexicalNode | null {
  const node = $getNodeByKey(nodeKey);
  return node ? $blockOf(node) : null;
}

export function kindOf(node: LexicalNode): BlockKind {
  return KIND_BY_TYPE[node.getType()] ?? "other";
}

/**
 * The node a menu opened on `node` is about: a paragraph holding only an
 * image, poll or equation means that node; anything else is itself.
 */
export function $menuTarget(node: LexicalNode): LexicalNode {
  if ($isParagraphNode(node) && node.getChildrenSize() === 1) {
    const child = node.getFirstChild();
    if (child && LONE_INLINE_KINDS.has(kindOf(child))) return child;
  }
  return node;
}

export function $blockInfo(nodeKey: NodeKey): BlockInfo | null {
  const node = $getNodeByKey(nodeKey);
  if (!node) return null;
  const block = $blockOf(node);
  const kind = kindOf(node);
  const parent = node.getParent();
  const info: BlockInfo = {
    kind,
    nodeKey,
    canMoveUp: block.getPreviousSibling() !== null,
    canMoveDown: block.getNextSibling() !== null,
    quote: block.getTextContent().trim().slice(0, 100) || kind,
  };
  if (LONE_INLINE_KINDS.has(kind) && $isParagraphNode(parent)) {
    info.align = parent.getFormatType();
  }
  if ("__caption" in node) {
    info.hasCaption = (node as { __caption?: string }).__caption !== undefined;
  }
  switch (kind) {
    case "heading":
      info.headingTag = (node as HeadingNode).getTag();
      break;
    case "list":
      info.listType = (node as ListNode).getListType();
      break;
    case "code":
      info.language = (node as CodeNode).getLanguage() ?? undefined;
      break;
    case "toggle":
      info.toggleVariant = (node as ToggleNode).getVariant();
      info.toggleLevel = (node as ToggleNode).getLevel();
      info.open = (node as ToggleNode).getOpen();
      break;
    case "collapsible":
      info.open = (node as CollapsibleContainerNode).getOpen();
      break;
    case "columns":
      info.columnTemplate = (node as LayoutContainerNode).getTemplateColumns();
      info.columnCount = (node as LayoutContainerNode).getChildrenSize();
      break;
    case "poll":
      info.hasVotes = (node as PollNode).getOptions().some((option) => option.votes.length > 0);
      break;
    case "review":
      info.rated = (node as ReviewNode).getRating() > 0;
      break;
    case "equation":
      info.inline = (node as EquationNode).isInline();
      break;
  }
  return info;
}

// ---------------------------------------------------------------------------
// Generic actions

/** Adds an empty line with "/" above or below the block, so the slash menu opens there. */
export function $insertSlashLine(nodeKey: NodeKey, where: "above" | "below"): boolean {
  const block = $blockByKey(nodeKey);
  if (!block) return false;
  const text = $createTextNode("/");
  const paragraph = $createParagraphNode().append(text);
  if (where === "above") {
    block.insertBefore(paragraph);
  } else {
    block.insertAfter(paragraph);
  }
  text.select(1, 1);
  return true;
}

function $serializeTree(node: LexicalNode): SerializedLexicalNode {
  const json = node.exportJSON();
  if ($isElementNode(node)) {
    return { ...json, children: node.getChildren().map($serializeTree) } as SerializedLexicalNode;
  }
  return json;
}

/** Unwraps comment highlights in a copy, so a duplicate does not join the original's threads. */
function $dropCommentMarks(node: LexicalNode) {
  if (!$isElementNode(node)) return;
  for (const child of node.getChildren()) {
    $dropCommentMarks(child);
  }
  if ($isMarkNode(node)) {
    for (const child of node.getChildren()) {
      node.insertBefore(child);
    }
    node.remove();
  }
}

export function $duplicateBlock(nodeKey: NodeKey): boolean {
  const block = $blockByKey(nodeKey);
  if (!block) return false;
  const copy = $parseSerializedNode($serializeTree(block));
  block.insertAfter(copy);
  $dropCommentMarks(copy);
  return true;
}

export function $moveBlock(nodeKey: NodeKey, direction: "up" | "down"): boolean {
  const block = $blockByKey(nodeKey);
  if (!block) return false;
  const sibling =
    direction === "up" ? block.getPreviousSibling() : block.getNextSibling();
  if (!sibling) return false;
  if (direction === "up") {
    sibling.insertBefore(block);
  } else {
    sibling.insertAfter(block);
  }
  return true;
}

/**
 * Removes the node. An inline image's paragraph goes with it when nothing
 * else is left in it (and it is not the document's only line).
 */
export function $deleteBlockNode(nodeKey: NodeKey): boolean {
  const node = $getNodeByKey(nodeKey);
  if (!node) return false;
  const parent = node.getParent();
  node.remove();
  if (
    $isParagraphNode(parent) &&
    parent.isEmpty() &&
    (parent.getParent()?.getChildrenSize() ?? 0) > 1
  ) {
    parent.remove();
  }
  return true;
}

/** Places an image, poll or equation by setting its paragraph's alignment. */
export function $alignInParagraph(nodeKey: NodeKey, align: ElementFormatType): boolean {
  const node = $getNodeByKey(nodeKey);
  const parent = node?.getParent();
  if (!node || !$isParagraphNode(parent)) return false;
  parent.setFormat(align);
  node.markDirty();
  return true;
}

export function $toggleCaption(nodeKey: NodeKey): boolean {
  const node = $getNodeByKey(nodeKey) as
    | (LexicalNode & { __caption?: string; setCaption?: (caption: string | null) => unknown })
    | null;
  if (!node?.setCaption) return false;
  node.setCaption(node.__caption === undefined ? "" : null);
  return true;
}

// ---------------------------------------------------------------------------
// Conversions. Each keeps the content: text moves into the new block, and
// containers that go away leave their content where they were.

/** Moves every child of `from` before `anchor`, in order. */
function $moveChildrenBefore(from: ElementNode, anchor: LexicalNode) {
  for (const child of from.getChildren()) {
    anchor.insertBefore(child);
  }
}

/** A heading's text in a toggle heading of the same level (or level 3 for H4–H6). */
export function $headingToToggle(nodeKey: NodeKey): boolean {
  const heading = $getNodeByKey(nodeKey) as HeadingNode | null;
  if (!heading || kindOf(heading) !== "heading") return false;
  const level = Math.min(3, Number(heading.getTag().slice(1))) as ToggleLevel;
  const toggle = $createToggleNode("heading", level);
  const title = $createToggleTitleNode();
  title.append(...heading.getChildren());
  toggle.append(title, $createToggleContentNode().append($createParagraphNode()));
  heading.replace(toggle);
  title.selectEnd();
  return true;
}

/** The toggle's title becomes a heading (or paragraph for a toggle list); its content follows. */
export function $unwrapToggle(nodeKey: NodeKey): boolean {
  const toggle = $getNodeByKey(nodeKey) as ToggleNode | null;
  if (!toggle || kindOf(toggle) !== "toggle") return false;
  const [title, content] = toggle.getChildren() as ElementNode[];
  const level = toggle.getLevel();
  const head =
    toggle.getVariant() === "heading" && level > 0
      ? $createHeadingNode(`h${level}` as HeadingTagType)
      : $createParagraphNode();
  if (title) head.append(...title.getChildren());
  toggle.insertBefore(head);
  if (content) $moveChildrenBefore(content, toggle);
  toggle.remove();
  return true;
}

export function $toggleToCollapsible(nodeKey: NodeKey): boolean {
  const toggle = $getNodeByKey(nodeKey) as ToggleNode | null;
  if (!toggle || kindOf(toggle) !== "toggle") return false;
  const [title, content] = toggle.getChildren() as ElementNode[];
  const collapsibleTitle = $createCollapsibleTitleNode();
  const paragraph = $createParagraphNode();
  if (title) paragraph.append(...title.getChildren());
  collapsibleTitle.append(paragraph);
  const collapsibleContent = $createCollapsibleContentNode();
  if (content) collapsibleContent.append(...content.getChildren());
  if (collapsibleContent.isEmpty()) collapsibleContent.append($createParagraphNode());
  toggle.replace(
    $createCollapsibleContainerNode(toggle.getOpen()).append(collapsibleTitle, collapsibleContent),
  );
  return true;
}

export function $collapsibleToToggle(nodeKey: NodeKey): boolean {
  const container = $getNodeByKey(nodeKey) as CollapsibleContainerNode | null;
  if (!container || kindOf(container) !== "collapsible") return false;
  const [title, content] = container.getChildren() as ElementNode[];
  const toggle = $createToggleNode("list", 0);
  const toggleTitle = $createToggleTitleNode();
  // The collapsible title holds paragraphs; a toggle title holds their text.
  title?.getChildren().forEach((child, index) => {
    if (index > 0) toggleTitle.append($createLineBreakNode());
    if ($isElementNode(child)) toggleTitle.append(...child.getChildren());
  });
  const toggleContent = $createToggleContentNode();
  if (content) toggleContent.append(...content.getChildren());
  if (toggleContent.isEmpty()) toggleContent.append($createParagraphNode());
  toggle.append(toggleTitle, toggleContent);
  if (!container.getOpen()) toggle.setOpen(false);
  container.replace(toggle);
  return true;
}

export function $unwrapCollapsible(nodeKey: NodeKey): boolean {
  const container = $getNodeByKey(nodeKey) as CollapsibleContainerNode | null;
  if (!container || kindOf(container) !== "collapsible") return false;
  for (const part of container.getChildren()) {
    if ($isElementNode(part)) $moveChildrenBefore(part, container);
  }
  container.remove();
  return true;
}

/** A card's title and body stay as plain blocks. */
export function $unwrapCard(nodeKey: NodeKey): boolean {
  const card = $getNodeByKey(nodeKey) as ElementNode | null;
  if (!card || kindOf(card) !== "card") return false;
  // The title slot is a paragraph; its text becomes a paragraph of its own.
  const title = $getSlot(card, "title");
  if ($isElementNode(title) && title.getTextContent().trim() !== "") {
    card.insertBefore($createParagraphNode().append(...title.getChildren()));
  }
  $moveChildrenBefore(card, card);
  card.remove();
  return true;
}

/** The pull quote's text becomes a quote; the attribution its last line ("— Name"). */
export function $pullQuoteToQuote(nodeKey: NodeKey): boolean {
  const pullQuote = $getNodeByKey(nodeKey) as ElementNode | null;
  if (!pullQuote || kindOf(pullQuote) !== "pullquote") return false;
  const quote = $createQuoteNode();
  const text = $getSlot(pullQuote, "quote");
  if (text && $isElementNode(text)) {
    text.getChildren().forEach((paragraph, index) => {
      if (index > 0) quote.append($createLineBreakNode());
      if ($isElementNode(paragraph)) quote.append(...paragraph.getChildren());
    });
  }
  const attribution = $getSlot(pullQuote, "attribution")?.getTextContent().trim();
  if (attribution) {
    quote.append($createLineBreakNode(), $createTextNode(`— ${attribution}`));
  }
  pullQuote.replace(quote);
  return true;
}

/** A quote becomes a pull quote with an empty attribution. */
export function $quoteToPullQuote(nodeKey: NodeKey): boolean {
  const quote = $getNodeByKey(nodeKey) as ElementNode | null;
  if (!quote || kindOf(quote) !== "quote") return false;
  const paragraph = $createParagraphNode().append(...quote.getChildren());
  const pullQuote = $createPullQuoteNode(
    $createSlotContainerNode().append(paragraph),
    $createParagraphNode(),
  );
  quote.replace(pullQuote);
  return true;
}

/** Code lines become paragraphs. */
export function $codeToParagraphs(nodeKey: NodeKey): boolean {
  const code = $getNodeByKey(nodeKey) as CodeNode | null;
  if (!code || kindOf(code) !== "code") return false;
  const lines = code.getTextContent().split("\n");
  for (const line of lines) {
    const paragraph = $createParagraphNode();
    if (line) paragraph.append($createTextNode(line));
    code.insertBefore(paragraph);
  }
  code.remove();
  return true;
}

export function $setCodeLanguage(nodeKey: NodeKey, language: string): boolean {
  const code = $getNodeByKey(nodeKey) as CodeNode | null;
  if (!code || kindOf(code) !== "code") return false;
  code.setLanguage(language);
  return true;
}

export const COLUMN_LAYOUTS: { count: number; template: string; label: "columnsEqual" | "columnsWideLeft" | "columnsWideMiddle" | "columnsWideRight" }[] = [
  { count: 2, template: "1fr 1fr", label: "columnsEqual" },
  { count: 2, template: "2fr 1fr", label: "columnsWideLeft" },
  { count: 2, template: "1fr 2fr", label: "columnsWideRight" },
  { count: 3, template: "1fr 1fr 1fr", label: "columnsEqual" },
  { count: 3, template: "2fr 1fr 1fr", label: "columnsWideLeft" },
  { count: 3, template: "1fr 2fr 1fr", label: "columnsWideMiddle" },
  { count: 3, template: "1fr 1fr 2fr", label: "columnsWideRight" },
  { count: 4, template: "1fr 1fr 1fr 1fr", label: "columnsEqual" },
];

/**
 * Sets the column layout. Added columns start with an empty line; removed
 * columns hand their content to the last column that stays, so nothing is
 * lost.
 */
export function $setColumnLayout(nodeKey: NodeKey, template: string): boolean {
  const container = $getNodeByKey(nodeKey) as LayoutContainerNode | null;
  if (!container || kindOf(container) !== "columns") return false;
  const count = template.trim().split(/\s+/).length;
  const items = container.getChildren() as ElementNode[];
  for (let index = items.length; index < count; index += 1) {
    container.append($createLayoutItemNode().append($createParagraphNode()));
  }
  if (items.length > count) {
    const keep = items[count - 1];
    for (const extra of items.slice(count)) {
      keep.append(...extra.getChildren());
      extra.remove();
    }
  }
  container.setTemplateColumns(template);
  return true;
}

/** The columns' content, stacked in reading order. */
export function $unwrapColumns(nodeKey: NodeKey): boolean {
  const container = $getNodeByKey(nodeKey) as LayoutContainerNode | null;
  if (!container || kindOf(container) !== "columns") return false;
  for (const item of container.getChildren()) {
    if ($isElementNode(item)) $moveChildrenBefore(item, container);
  }
  container.remove();
  return true;
}

export function $setOpen(nodeKey: NodeKey, open: boolean): boolean {
  const node = $getNodeByKey(nodeKey);
  if (!node) return false;
  const kind = kindOf(node);
  if (kind === "toggle") (node as ToggleNode).setOpen(open);
  else if (kind === "collapsible") (node as CollapsibleContainerNode).setOpen(open);
  else return false;
  return true;
}

export function $setToggleLevel(nodeKey: NodeKey, level: ToggleLevel): boolean {
  const toggle = $getNodeByKey(nodeKey) as ToggleNode | null;
  if (!toggle || kindOf(toggle) !== "toggle") return false;
  toggle.setLevel(level);
  return true;
}

/** Every column gets the same share of the table's current width. */
export function $evenTableColumns(nodeKey: NodeKey): boolean {
  const table = $getNodeByKey(nodeKey) as TableNode | null;
  if (!table || kindOf(table) !== "table") return false;
  // A table never resized has no stored widths, so measure the rendered ones.
  const widths = measureColumnWidths(table, $getEditor(), table.getColumnCount());
  if (widths.length === 0) return false;
  const total = widths.reduce((sum, width) => sum + width, 0);
  table.setColWidths(widths.map(() => total / widths.length));
  return true;
}

export function $addBoardColumn(nodeKey: NodeKey, title: string): boolean {
  const board = $getNodeByKey(nodeKey) as BoardNode | null;
  if (!board || kindOf(board) !== "board") return false;
  board.setColumns((columns) => [...columns, createBoardColumn(title)]);
  return true;
}

export function $resetPollVotes(nodeKey: NodeKey): boolean {
  const poll = $getNodeByKey(nodeKey) as PollNode | null;
  if (!poll || kindOf(poll) !== "poll") return false;
  poll.setOptions((options) => options.map((option) => ({ ...option, votes: [] })));
  return true;
}

export function $clearRating(nodeKey: NodeKey): boolean {
  const review = $getNodeByKey(nodeKey) as ReviewNode | null;
  if (!review || kindOf(review) !== "review") return false;
  review.setRating(0);
  return true;
}

/**
 * Inline equations sit in a paragraph, block equations on their own. Going
 * inline wraps the equation in a paragraph; going to a block moves it out,
 * with any text after it continuing in a new paragraph.
 */
export function $setEquationInline(nodeKey: NodeKey, inline: boolean): boolean {
  const equation = $getNodeByKey(nodeKey) as EquationNode | null;
  if (!equation || kindOf(equation) !== "equation" || equation.isInline() === inline) return false;
  if (inline) {
    const paragraph = $createParagraphNode();
    equation.insertBefore(paragraph);
    paragraph.append(equation.setInline(true));
    return true;
  }
  const parent = equation.getParent();
  if (!$isParagraphNode(parent)) return false;
  const rest = equation.getNextSiblings();
  parent.insertAfter(equation.setInline(false));
  if (rest.length > 0) {
    equation.insertAfter($createParagraphNode().append(...rest));
  }
  if (parent.isEmpty()) parent.remove();
  return true;
}
