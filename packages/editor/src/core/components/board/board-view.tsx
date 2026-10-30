"use client";

import { useEffect, useRef } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  type NodeKey,
} from "lexical";

import type { BoardColumns } from "../../lib/board";

import { type BoardChange, BoardSurface } from "./board-surface";

export type { BoardActions, BoardChange, BoardEditing } from "./board-surface";

/** The board block inside the editor: block selection and caret handling. */
export function BoardView({
  nodeKey,
  title,
  columns,
  focusClassName,
  onChange,
}: {
  nodeKey: NodeKey;
  title: string;
  columns: BoardColumns;
  focusClassName: string;
  onChange: (change: BoardChange) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const frameRef = useRef<HTMLDivElement | null>(null);

  // Clicking the board chrome (not a card, field, or button) selects the block.
  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const target = event.target;
          if (
            !(target instanceof Element) ||
            !target.hasAttribute("data-board-chrome") ||
            !frameRef.current?.contains(target)
          ) {
            return false;
          }
          event.preventDefault();
          if (!event.shiftKey) {
            clearSelection();
          }
          setSelected(!isSelected);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [clearSelection, editor, isSelected, setSelected],
  );

  return (
    <BoardSurface
      title={title}
      columns={columns}
      isEditable={isEditable}
      onChange={onChange}
      frameRef={frameRef}
      frameClassName={isSelected ? focusClassName : undefined}
      onFrameFocus={(event) => {
        // A field inside the board owns the caret now. Drop Lexical's selection so
        // Backspace, Tab, or Enter cannot act on the block or the last paragraph.
        if (event.target.matches("input, textarea")) {
          editor.update(() => $setSelection(null));
        }
      }}
    />
  );
}
