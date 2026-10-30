import {
  $convertSelectionToMarkdownString,
  $convertToMarkdownString,
  $generateNodesFromMarkdownString,
} from "@lexical/markdown";
import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  type LexicalNode,
  type NodeKey,
  type Point,
  type RangeSelection,
} from "lexical";

import type { DocumentAiMode, DocumentAiRequest } from "../../adapters/types";

import { MARKDOWN_TRANSFORMERS } from "../extensions/document";


export type AiActionKey =
  | "improve_writing"
  | "fix_spelling"
  | "translate_content"
  | "simplify_content"
  | "make_informal"
  | "summarize_content"
  | "expand_content"
  | "expand_with_research"
  | "add_citations"
  | "generate_table"
  | "creative_storytelling"
  | "continue_with_ai"
  | "generate_ideas"
  | "add_related_topics"
  | "executive_summary"
  | "extract_action_items";

/**
 * `edit` actions rewrite the selection and show only with one; `write` and
 * `document` actions add new content and show without one.
 */
export type AiActionGroup = "edit" | "write" | "document";

export type AiAction = {
  group: AiActionGroup;
  mode: DocumentAiMode;
  /** Sent as `userPrompt`. */
  prompt: string;
  /** Fills the prompt for the user to finish instead of running. */
  prefill?: boolean;
};

/** Prompts and placements carried over from the BlockNote editor's AI menu. */
export const AI_ACTIONS: Record<AiActionKey, AiAction> = {
  improve_writing: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Improve the selected writing for clarity, flow, grammar, and readability. Preserve the original meaning, voice, and important details.",
  },
  fix_spelling: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Fix spelling, punctuation, and grammar issues in the selected text. Keep the wording and structure as close to the original as possible.",
  },
  translate_content: {
    group: "edit",
    mode: "replace-selection",
    prompt: "Translate the selected content to ",
    prefill: true,
  },
  simplify_content: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Simplify the selected content so it is easier to understand. Use plain language, shorter sentences, and keep all essential meaning.",
  },
  make_informal: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Transform the selected text to have a more informal, casual, and friendly tone. Maintain the same meaning and structure, but make it sound more conversational and approachable. Use contractions, simpler language, and a warm tone.",
  },
  summarize_content: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Create a comprehensive summary of the selected content that captures all the key points, main ideas, and important details. The summary should be detailed enough to give a complete understanding of the original content while being more concise. Include bullet points for key takeaways and a brief conclusion.",
  },
  expand_content: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Take the selected content and expand it significantly by adding more depth, examples, explanations, and supporting details. Transform it into a comprehensive piece that covers the topic thoroughly. Add relevant examples, case studies, statistics, or detailed explanations that make the content more valuable and informative. Aim to at least double the length while maintaining quality and relevance.",
  },
  expand_with_research: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Expand the selected section with more depth, data, and analysis. Add specific examples, statistics, comparisons, and expert perspectives. " +
      "Structure the expansion with clear sub-sections. Include concrete numbers and facts where possible. " +
      "Reference the context from the rest of the document to maintain consistency. " +
      "The expanded content should read like a well-researched report section.",
  },
  add_citations: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Review the selected text and add proper inline citations in [Author, Year] format where claims, statistics, or factual statements are made. " +
      "At the end of the section, add a 'References' list with the full citation details. " +
      "If specific sources are not known, add placeholder citations like [Source needed] to flag areas that need verification. " +
      "Do not modify the original content — only add citation markers and the references section.",
  },
  generate_table: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Analyze the content and extract the key data points, comparisons, or information that can be organized into a structured table. " +
      "Create a markdown table with appropriate column headers. " +
      "If the content contains comparisons, create a comparison matrix. " +
      "If it contains lists of items with attributes, create a feature/attribute table. " +
      "Add the table after the selected content.",
  },
  creative_storytelling: {
    group: "edit",
    mode: "replace-selection",
    prompt:
      "Transform the current content into an engaging, creative narrative or story. Use vivid descriptions, emotional elements, and compelling storytelling techniques. Make it memorable and engaging while maintaining the core message or information. Add dialogue, sensory details, and narrative structure to make it more compelling.",
  },
  continue_with_ai: {
    group: "write",
    mode: "insert-after-cursor",
    prompt:
      "Continue the content naturally by adding 3-4 substantial paragraphs that build upon the existing content. Maintain the same writing style, tone, and level of detail. Each paragraph should be well-developed (4-5 sentences) and should expand on the current topic with new insights, examples, or related concepts. Ensure the continuation flows seamlessly from the existing content.",
  },
  generate_ideas: {
    group: "write",
    mode: "insert-after-cursor",
    prompt:
      "Based on the current content, generate 7-10 creative ideas, suggestions, or approaches that could expand on this topic. For each idea, provide a detailed explanation (2-3 sentences) of how it could be implemented or why it's relevant. Make the ideas practical, innovative, and well-thought-out.",
  },
  add_related_topics: {
    group: "write",
    mode: "insert-after-cursor",
    prompt:
      "Analyze the current content and generate 5-7 related topics or subtopics. For each topic, write a comprehensive paragraph (3-4 sentences) that explains the concept and its connection to the main content. Add these as new paragraphs after the current content. Make sure each topic is well-developed and provides valuable insights.",
  },
  executive_summary: {
    group: "document",
    mode: "insert-before-document",
    prompt:
      "Write a concise executive summary of the entire document. The summary should: " +
      "1. Start with a one-sentence overview of the topic " +
      "2. List 3-5 key findings or takeaways as bullet points " +
      "3. Include a brief conclusion with recommended next steps " +
      "4. Be no longer than 200 words " +
      "Place the executive summary at the beginning of the document, before the current content. " +
      "Format it with a '## Executive Summary' heading.",
  },
  extract_action_items: {
    group: "document",
    mode: "append-document",
    prompt:
      "Analyze the entire document and extract all actionable recommendations, next steps, and tasks. " +
      "Format them as a checklist under a '## Action Items' heading. " +
      "For each action item, include: " +
      "- A clear, actionable description (start with a verb) " +
      "- Priority level: [High], [Medium], or [Low] " +
      "- Brief context on why this action matters " +
      "Add the action items section at the end of the document.",
  },
};

/** The server's limits (`/api/ai/regular/streamText` and `validatePromptLength`). */
export const AI_MAX_PROMPT_LENGTH = 15_000;
const AI_MAX_CONTEXT_LENGTH = 60_000;

/**
 * What the AI works on, captured when the menu opens: the selection to rewrite
 * (when there is one) and the block new content goes below.
 */
export type AiTarget = {
  selection: RangeSelection | null;
  blockKey: NodeKey | null;
};

export function $readAiTarget(): AiTarget {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    const block = selection.focus.getNode().getTopLevelElement();
    return {
      selection: selection.isCollapsed() ? null : selection.clone(),
      blockKey: block?.getKey() ?? null,
    };
  }
  if ($isNodeSelection(selection)) {
    const node = selection.getNodes()[0];
    const block = node?.getTopLevelElement() ?? node;
    return { selection: null, blockKey: block?.getKey() ?? null };
  }
  return { selection: null, blockKey: $getRoot().getLastChild()?.getKey() ?? null };
}

/** The saved selection, if its nodes are still in the document. */
function $liveSelection(target: AiTarget): RangeSelection | null {
  const selection = target.selection;
  if (!selection) {
    return null;
  }
  // `getNode` throws when the node was removed since the menu opened.
  try {
    return selection.anchor.getNode().isAttached() &&
      selection.focus.getNode().isAttached()
      ? selection.clone()
      : null;
  } catch {
    return null;
  }
}

function $targetBlock(target: AiTarget): LexicalNode | null {
  const selection = $liveSelection(target);
  if (selection) {
    const [, end] = $orderedPoints(selection);
    return end.getNode().getTopLevelElement();
  }
  const block = target.blockKey ? $getNodeByKey(target.blockKey) : null;
  return block?.isAttached() ? block : $getRoot().getLastChild();
}

function $blockMarkdown(block: LexicalNode | null): string {
  if (!block) {
    return "";
  }
  if (!$isElementNode(block)) {
    return block.getTextContent();
  }
  const range = $createRangeSelection();
  range.anchor.set(block.getKey(), 0, "element");
  range.focus.set(block.getKey(), block.getChildrenSize(), "element");
  return $convertSelectionToMarkdownString(MARKDOWN_TRANSFORMERS, range);
}


/** Builds the request body; read inside `editor.read`. */
export function $buildDocumentAiRequest(
  target: AiTarget,
  input: Pick<DocumentAiRequest, "workspaceId" | "userPrompt" | "actionKey" | "mode">,
): DocumentAiRequest {
  const selection = $liveSelection(target);
  const selectionMarkdown = selection
    ? $convertSelectionToMarkdownString(MARKDOWN_TRANSFORMERS, selection)
    : "";
  const cursorBlockMarkdown = $blockMarkdown($targetBlock(target));
  let documentMarkdown = $convertToMarkdownString(MARKDOWN_TRANSFORMERS);
  // The server rejects oversized context; the selection and the current block
  // matter most, so the document is what gets cut.
  const budget =
    AI_MAX_CONTEXT_LENGTH - selectionMarkdown.length - cursorBlockMarkdown.length;
  if (documentMarkdown.length > budget) {
    documentMarkdown = documentMarkdown.slice(0, Math.max(0, budget));
  }
  return { ...input, documentMarkdown, selectionMarkdown, cursorBlockMarkdown };
}

/** Converts a Markdown result to document nodes (detached). */
export function $aiResultNodes(markdown: string): LexicalNode[] {
  return $generateNodesFromMarkdownString(markdown.trim(), MARKDOWN_TRANSFORMERS);
}

function $orderedPoints(selection: RangeSelection): [Point, Point] {
  const [anchor, focus] = [selection.anchor, selection.focus];
  return selection.isBackward() ? [focus, anchor] : [anchor, focus];
}

function $isAtBlockStart(point: Point, block: ElementNode): boolean {
  const node = point.getNode();
  if (point.offset !== 0) {
    return false;
  }
  return node.is(block) || node.is(block.getFirstDescendant());
}

function $isAtBlockEnd(point: Point, block: ElementNode): boolean {
  const node = point.getNode();
  if (node.is(block)) {
    return point.offset === block.getChildrenSize();
  }
  return (
    node.is(block.getLastDescendant()) &&
    point.offset ===
      ($isElementNode(node) ? node.getChildrenSize() : node.getTextContentSize())
  );
}

function $isEmptyParagraph(node: LexicalNode | null): boolean {
  return $isParagraphNode(node) && node.getTextContentSize() === 0 && node.getChildrenSize() === 0;
}

function $insertAfter(anchor: LexicalNode, nodes: LexicalNode[]) {
  let previous = anchor;
  for (const node of nodes) {
    previous.insertAfter(node);
    previous = node;
  }
}

function $selectAfterInsert(nodes: LexicalNode[]) {
  const last = nodes.at(-1);
  if (!last?.isAttached()) {
    return;
  }
  if ($isElementNode(last)) {
    last.selectEnd();
  } else if ($isDecoratorNode(last)) {
    last.selectNext();
  }
}

/**
 * The top-level blocks a selection covers completely (from the start of its
 * first block to the end of its last), or `null` for a partial selection.
 * Replace swaps whole blocks and takes partial selections inline.
 */
function $wholeBlocks(selection: RangeSelection): [LexicalNode, ...LexicalNode[]] | null {
  const [start, end] = $orderedPoints(selection);
  const first = start.getNode().getTopLevelElement();
  const last = end.getNode().getTopLevelElement();
  if (
    !$isElementNode(first) ||
    !$isElementNode(last) ||
    !$isAtBlockStart(start, first) ||
    !$isAtBlockEnd(end, last)
  ) {
    return null;
  }
  const blocks: [LexicalNode, ...LexicalNode[]] = [first];
  let next = first.getNextSibling();
  while (next && !blocks.at(-1)?.is(last)) {
    blocks.push(next);
    next = next.getNextSibling();
  }
  return blocks;
}

/**
 * Nodes Markdown cannot carry, by type. The AI sees their text at most, so
 * Replace would drop them. `mark` is a comment thread's highlight.
 */
const LOSSY_NODE_LABELS: Record<string, string> = {
  board: "board",
  poll: "poll",
  equation: "equation",
  tweet: "post",
  youtube: "YouTube video",
  video: "video",
  audio: "audio",
  file: "file",
  mention: "mention",
  datetime: "date",
  toggle: "toggle",
  card: "card",
  "collapsible-container": "collapsible",
  "layout-container": "columns",
  pullquote: "pull quote",
  review: "review",
  mark: "comment",
};

function $collectWithDescendants(node: LexicalNode, into: Set<LexicalNode>) {
  into.add(node);
  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      $collectWithDescendants(child, into);
    }
  }
}

/**
 * What Replace would remove that the result cannot bring back, as labels
 * ("board", "comment"), each listed once. Empty without a selection.
 */
export function $lossyReplaceLabels(target: AiTarget): string[] {
  const selection = $liveSelection(target);
  if (!selection) {
    return [];
  }
  const nodes = new Set<LexicalNode>();
  const blocks = $wholeBlocks(selection);
  if (blocks) {
    blocks.forEach((block) => $collectWithDescendants(block, nodes));
  } else {
    for (const node of selection.getNodes()) {
      nodes.add(node);
      // A partly selected comment or link loses the selected text inside it.
      for (let parent = node.getParent(); $isElementNode(parent) && parent.isInline(); parent = parent.getParent()) {
        nodes.add(parent);
      }
    }
  }
  const labels = new Set<string>();
  for (const node of nodes) {
    const label = LOSSY_NODE_LABELS[node.getType()];
    if (label) {
      labels.add(label);
    }
  }
  return [...labels];
}

export type AiPlacement = "replace" | "below" | "top" | "end";

export function placementForMode(mode: DocumentAiMode, hasSelection: boolean): AiPlacement {
  switch (mode) {
    case "replace-selection":
      return hasSelection ? "replace" : "below";
    case "insert-before-document":
      return "top";
    case "append-document":
      return "end";
    default:
      return "below";
  }
}

/**
 * Writes the result into the document. Replacing a selection that covers
 * whole blocks swaps the blocks, so the result's headings and lists stay;
 * a partial selection takes the result inline, like a paste.
 */
export function $applyAiResult(
  markdown: string,
  placement: AiPlacement,
  target: AiTarget,
) {
  const nodes = $aiResultNodes(markdown);
  if (nodes.length === 0) {
    return;
  }
  const root = $getRoot();

  if (placement === "replace") {
    const selection = $liveSelection(target);
    if (selection) {
      const blocks = $wholeBlocks(selection);
      if (blocks) {
        const [first] = blocks;
        for (const node of nodes) {
          first.insertBefore(node);
        }
        for (const block of blocks) {
          block.remove();
        }
        $selectAfterInsert(nodes);
        return;
      }
      $setSelection(selection);
      selection.insertNodes(nodes);
      return;
    }
    placement = "below";
  }

  if (placement === "top") {
    const first = root.getFirstChild();
    if (first) {
      for (const node of nodes) {
        first.insertBefore(node);
      }
    } else {
      root.append(...nodes);
    }
  } else if (placement === "end") {
    const last = root.getLastChild();
    if (last && $isEmptyParagraph(last)) {
      $insertAfter(last, nodes);
      last.remove();
    } else {
      root.append(...nodes);
    }
  } else {
    const block = $targetBlock(target);
    if (!block) {
      root.append(...nodes);
    } else if ($isEmptyParagraph(block)) {
      $insertAfter(block, nodes);
      block.remove();
    } else {
      $insertAfter(block, nodes);
    }
  }
  $selectAfterInsert(nodes);
}
