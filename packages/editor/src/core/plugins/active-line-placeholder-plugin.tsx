"use client";

import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $canShowPlaceholder } from "@lexical/text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
} from "lexical";

const PLACEHOLDER_ATTRIBUTE = "data-lexical-active-placeholder";

export function ActiveLinePlaceholderPlugin({
  placeholder,
}: {
  placeholder: string;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let rootElement: HTMLElement | null = null;
    let activeParagraph: HTMLElement | null = null;

    const clearPlaceholder = () => {
      activeParagraph?.removeAttribute(PLACEHOLDER_ATTRIBUTE);
      activeParagraph = null;
    };

    const syncPlaceholder = () => {
      if (
        !rootElement ||
        document.activeElement !== rootElement ||
        !editor.isEditable() ||
        editor.isComposing()
      ) {
        clearPlaceholder();
        return;
      }

      const paragraphKey = editor.getEditorState().read(() => {
        if ($canShowPlaceholder(editor.isComposing())) return null;

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

        const anchor = selection.anchor.getNode();
        const paragraph = $isParagraphNode(anchor)
          ? anchor
          : $findMatchingParent(anchor, $isParagraphNode);

        if (!paragraph?.isEmpty() || paragraph.getParent() !== $getRoot()) {
          return null;
        }

        return paragraph.getKey();
      });

      const nextParagraph = paragraphKey
        ? editor.getElementByKey(paragraphKey)
        : null;

      if (
        nextParagraph === activeParagraph &&
        activeParagraph?.getAttribute(PLACEHOLDER_ATTRIBUTE) === placeholder
      ) {
        return;
      }

      clearPlaceholder();
      if (nextParagraph && rootElement.contains(nextParagraph)) {
        nextParagraph.setAttribute(PLACEHOLDER_ATTRIBUTE, placeholder);
        activeParagraph = nextParagraph;
      }
    };

    const removeRootListener = editor.registerRootListener((nextRoot, previousRoot) => {
      previousRoot?.removeEventListener("focus", syncPlaceholder);
      previousRoot?.removeEventListener("blur", clearPlaceholder);
      rootElement = nextRoot;
      nextRoot?.addEventListener("focus", syncPlaceholder);
      nextRoot?.addEventListener("blur", clearPlaceholder);
      syncPlaceholder();
    });
    const removeUpdateListener = editor.registerUpdateListener(syncPlaceholder);
    const removeEditableListener = editor.registerEditableListener(syncPlaceholder);

    return () => {
      removeRootListener();
      removeUpdateListener();
      removeEditableListener();
      rootElement?.removeEventListener("focus", syncPlaceholder);
      rootElement?.removeEventListener("blur", clearPlaceholder);
      clearPlaceholder();
    };
  }, [editor, placeholder]);

  return null;
}
