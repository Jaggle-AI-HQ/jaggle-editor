import { $createCodeNode } from "@lexical/code";
import { $createHorizontalRuleNode } from "@lexical/extension";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";

import { $createBoardNode } from "../nodes/board-node";
import { $createEquationNode } from "../nodes/equation-node";
import { $createPollNode, createPollOption } from "../nodes/poll-node";
import {
  $createToggleBlock,
  $isToggleContentNode,
  $isToggleNode,
  type ToggleLevel,
} from "../nodes/toggle-node";
import { $createTweetNode, parseTweetId } from "../nodes/tweet-node";
import {
  $createYouTubeNode,
  parseYouTubeVideoId,
} from "../nodes/youtube-node";

export type BlockId =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "toggle-h1"
  | "toggle-h2"
  | "toggle-h3"
  | "quote"
  | "toggle-list"
  | "bullet"
  | "number"
  | "check"
  | "code"
  | "divider"
  | "table"
  | "equation"
  | "poll"
  | "board"
  | "tweet"
  | "youtube";

function listCommand(id: BlockId) {
  if (id === "bullet") return INSERT_UNORDERED_LIST_COMMAND;
  if (id === "number") return INSERT_ORDERED_LIST_COMMAND;
  if (id === "check") return INSERT_CHECK_LIST_COMMAND;
  return null;
}

function $transformableBlock(): ElementNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  let node: LexicalNode | null = selection.anchor.getNode();
  if ($isTextNode(node) || node.isInline()) node = node.getParent();

  while (node) {
    const parent = node.getParent();
    if (!parent) return null;
    if (
      $isRootNode(parent) ||
      $isToggleContentNode(parent) ||
      $isListNode(parent)
    ) {
      return $isElementNode(node) ? node : null;
    }
    node = parent;
  }

  return null;
}

function $replaceBlock(block: ElementNode, next: LexicalNode) {
  const parent = block.getParent();
  if (parent && $isListNode(parent)) {
    block.remove();
    if (parent.getChildrenSize() === 0) parent.replace(next);
    else parent.insertAfter(next);
    return;
  }
  block.replace(next);
}

function $writeContent(content?: string) {
  if (!content) return;
  const selection = $getSelection();
  if ($isRangeSelection(selection)) selection.insertText(content);
}

function $applyBlock(id: BlockId, content?: string) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;

  if (id === "paragraph") {
    $setBlocksType(selection, () => $createParagraphNode());
    $writeContent(content);
    return;
  }
  if (id === "h1" || id === "h2" || id === "h3" || id === "h4" || id === "h5" || id === "h6") {
    $setBlocksType(selection, () => $createHeadingNode(id));
    $writeContent(content);
    return;
  }
  if (id === "quote") {
    $setBlocksType(selection, () => $createQuoteNode());
    $writeContent(content);
    return;
  }
  if (id === "code") {
    $setBlocksType(selection, () => $createCodeNode());
    $writeContent(content);
    return;
  }

  const block = $transformableBlock();
  if (!block) return;
  const blockText = $isToggleNode(block)
    ? (block.getFirstChild()?.getTextContent() ?? "")
    : block.getTextContent();
  const text = content ?? blockText;

  if (id === "equation") {
    $replaceBlock(block, $createEquationNode(text.trim(), false));
    return;
  }
  if (id === "poll") {
    $replaceBlock(
      block,
      $createPollNode(text.trim(), [createPollOption(), createPollOption()]),
    );
    return;
  }
  if (id === "board") {
    const board = $createBoardNode(text.trim());
    const next = $createParagraphNode();
    $replaceBlock(block, board);
    board.insertAfter(next);
    next.select();
    return;
  }
  if (id === "tweet") {
    $replaceBlock(block, $createTweetNode(parseTweetId(text) ?? ""));
    return;
  }
  if (id === "youtube") {
    $replaceBlock(block, $createYouTubeNode(parseYouTubeVideoId(text) ?? ""));
    return;
  }

  if (id === "divider") {
    const rule = $createHorizontalRuleNode();
    const next = $createParagraphNode();
    $replaceBlock(block, rule);
    rule.insertAfter(next);
    next.select();
    return;
  }

  const level = toggleLevel(id);
  const variant = id === "toggle-list" ? "list" : "heading";
  const toggle = $createToggleBlock(variant, level, text);
  $replaceBlock(block, toggle);
  const title = toggle.getFirstChild();
  if (title) title.selectEnd();
}

function toggleLevel(id: BlockId): ToggleLevel {
  if (id === "toggle-h1") return 1;
  if (id === "toggle-h2") return 2;
  if (id === "toggle-h3") return 3;
  return 0;
}

/** Already inside an editor update. Slash selection must use this path. */
export function $commitDocumentBlock(
  editor: LexicalEditor,
  id: BlockId,
  content?: string,
) {
  if (id === "table") {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: "3",
      rows: "3",
      includeHeaders: { rows: true, columns: false },
    });
    $writeContent(content);
    return;
  }
  const command = listCommand(id);
  if (command) {
    editor.dispatchCommand(command, undefined);
    $writeContent(content);
    return;
  }
  $applyBlock(id, content);
}

export function applyDocumentBlock(
  editor: LexicalEditor,
  id: BlockId,
  prepare?: () => void,
) {
  editor.update(() => {
    prepare?.();
    $commitDocumentBlock(editor, id);
  });
}