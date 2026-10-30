"use client";

import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
} from "lexical";

import {
  $isToggleContentNode,
  $isToggleNode,
  $isToggleTitleNode,
} from "../nodes/toggle-node";

export function TogglePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerRootListener((root) => {
      if (!root) return;

      const onMouseDown = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const title = target.closest("[data-toggle-title]");
        if (!(title instanceof HTMLElement)) return;
        const rect = title.getBoundingClientRect();
        if (event.clientX > rect.left + 24) return;

        event.preventDefault();
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(title);
          const toggle = node ? node.getParent() : null;
          if (!$isToggleNode(toggle)) return;
          const open = !toggle.getOpen();
          toggle.setOpen(open);
          if (!open) {
            const titleNode = toggle.getFirstChild();
            if ($isToggleTitleNode(titleNode)) titleNode.selectEnd();
          }
        });
      };

      root.addEventListener("mousedown", onMouseDown);
      return () => root.removeEventListener("mousedown", onMouseDown);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const anchor = selection.anchor.getNode();
        const title = $isToggleTitleNode(anchor)
          ? anchor
          : $findMatchingParent(anchor, $isToggleTitleNode);
        if (!$isToggleTitleNode(title)) return false;

        event?.preventDefault();
        const toggle = title.getParent();
        if (!$isToggleNode(toggle)) return false;
        if (!toggle.getOpen()) toggle.setOpen(true);
        const content = toggle.getLastChild();
        if (!$isToggleContentNode(content)) return true;
        const first = content.getFirstChild();
        const paragraph = $isParagraphNode(first) ? first : $createParagraphNode();
        if (paragraph.getParent() !== content) content.append(paragraph);
        paragraph.select();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        if (selection.anchor.offset !== 0) return false;
        const anchor = selection.anchor.getNode();
        const title = $isToggleTitleNode(anchor)
          ? anchor
          : $findMatchingParent(anchor, $isToggleTitleNode);
        if (!$isToggleTitleNode(title) || title.getTextContent() !== "") {
          return false;
        }

        event?.preventDefault();
        const toggle = title.getParent();
        if (!$isToggleNode(toggle)) return false;
        const paragraph = $createParagraphNode();
        const content = toggle.getLastChild();
        toggle.insertBefore(paragraph);
        if ($isToggleContentNode(content)) {
          let after: typeof paragraph | ReturnType<typeof content.getLastChild> =
            paragraph;
          for (const child of content.getChildren()) {
            if (!after) break;
            after.insertAfter(child);
            after = child;
          }
        }
        toggle.remove();
        paragraph.select();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
