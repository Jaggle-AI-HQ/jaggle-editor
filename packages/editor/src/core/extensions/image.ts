import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  type BaseSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  defineExtension,
  HISTORY_MERGE_TAG,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  mergeRegister,
  type NodeKey,
} from "lexical";

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
  INSERT_IMAGE_COMMAND,
  type InsertImagePayload,
} from "../nodes/image-node";

export function $insertImage(payload: InsertImagePayload): boolean {
  $insertImageNode(payload);
  return true;
}

/** Inserts an image at the selection, caret below it; returns the image. */
export function $insertImageNode(payload: InsertImagePayload): ImageNode {
  const imageNode = $createImageNode(payload);
  $insertNodes([imageNode]);
  if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
    const paragraph = $createParagraphNode();
    imageNode.replace(paragraph);
    paragraph.append(imageNode);
  }
  $selectAfterImage(imageNode);
  return imageNode;
}

/**
 * Puts the caret in the block after an image, so writing continues below it
 * (a caret left beside an inline image sits at its corner and types next to
 * it). Text after the image moves to that block; an empty paragraph that
 * already follows is reused. In a list item, the caret goes right after the
 * image instead.
 */
export function $selectAfterImage(image: ImageNode) {
  const block = image.getParent();
  if (!$isElementNode(block) || !$isRootOrShadowRoot(block.getParentOrThrow())) {
    image.selectNext();
    return;
  }
  const rest: LexicalNode[] = [];
  for (let node = image.getNextSibling(); node; node = node.getNextSibling()) {
    rest.push(node);
  }
  if (rest.some((node) => node.getTextContent() !== "" || !$isTextNode(node))) {
    const paragraph = $createParagraphNode();
    block.insertAfter(paragraph);
    paragraph.append(...rest);
    paragraph.selectStart();
    return;
  }
  rest.forEach((node) => node.remove());
  const next = block.getNextSibling();
  if ($isParagraphNode(next) && next.isEmpty()) {
    next.selectStart();
    return;
  }
  const paragraph = $createParagraphNode();
  block.insertAfter(paragraph);
  paragraph.select();
}

export function registerInsertImageCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_IMAGE_COMMAND,
    $insertImage,
    COMMAND_PRIORITY_EDITOR,
  );
}

/** The image a collapsed caret sits in front of, when nothing precedes it in its block. */
function $imageKeyAtBlockStart(selection: BaseSelection | null): NodeKey | null {
  if (
    !$isRangeSelection(selection) ||
    !selection.isCollapsed() ||
    selection.anchor.type !== "element" ||
    selection.anchor.offset !== 0
  ) {
    return null;
  }
  const first = selection.anchor.getNode().getFirstChild();
  return $isImageNode(first) ? first.getKey() : null;
}

function $selectNode(node: LexicalNode) {
  const selection = $createNodeSelection();
  selection.add(node.getKey());
  $setSelection(selection);
}

/** Moves the caret to the end of the block before the image's block. */
function $selectBlockBefore(image: ImageNode): boolean {
  const previous = image.getParent()?.getPreviousSibling();
  if ($isElementNode(previous)) {
    previous.selectEnd();
    return true;
  }
  if ($isDecoratorNode(previous)) {
    $selectNode(previous);
    return true;
  }
  return false;
}

/**
 * Images are inline, so the browser can put the caret in front of an image
 * that starts its block, and typing there writes text beside the image. A
 * caret that lands there selects the image instead. Moving left off a selected
 * image goes to the end of the previous block, so the caret is never trapped.
 */
export function registerImageCaretGuard(editor: LexicalEditor) {
  return editor.registerUpdateListener(
    ({ editorState, prevEditorState, tags }) => {
      if (!editor.isEditable() || tags.has(COLLABORATION_TAG)) {
        return;
      }
      const imageKey = editorState.read(() =>
        $imageKeyAtBlockStart($getSelection()),
      );
      if (imageKey === null) {
        return;
      }
      const leavingImage = prevEditorState.read(() => {
        const previous = $getSelection();
        return $isNodeSelection(previous) && previous.has(imageKey);
      });
      editor.update(
        () => {
          const image = $getNodeByKey(imageKey);
          if (
            !$isImageNode(image) ||
            $imageKeyAtBlockStart($getSelection()) !== imageKey
          ) {
            return;
          }
          if (leavingImage && $selectBlockBefore(image)) {
            return;
          }
          $selectNode(image);
        },
        { tag: HISTORY_MERGE_TAG },
      );
    },
  );
}

/**
 * A selected image has no caret, so a typed character would land wherever the
 * browser's stale DOM caret is, often the start of the document. Printable
 * keys do nothing while an image is selected; Delete, Backspace, arrows, and
 * shortcuts keep their behavior.
 */
export function registerSelectedImageTypingGuard(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_DOWN_COMMAND,
    (event) => {
      if (
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      ) {
        return false;
      }
      const selection = $getSelection();
      if (
        !$isNodeSelection(selection) ||
        !selection.getNodes().some($isImageNode)
      ) {
        return false;
      }
      event.preventDefault();
      return true;
    },
    COMMAND_PRIORITY_LOW,
  );
}

export const ImageExtension = defineExtension({
  name: "@jaggle/lexical/image",
  nodes: () => [ImageNode],
  register: (editor) =>
    mergeRegister(
      registerInsertImageCommand(editor),
      registerImageCaretGuard(editor),
      registerSelectedImageTypingGuard(editor),
    ),
});
