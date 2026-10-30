import { useEffect, useRef } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, createCommand, type LexicalCommand, type NodeKey } from "lexical";

/**
 * Block menu actions that need the block's own view: a file picker, a dialog,
 * or a value only the view has (a resolved download URL, the equation editor).
 * The menu dispatches; the view for `nodeKey` handles it.
 */
export type BlockViewAction = "download" | "replace" | "alt-text" | "rename" | "edit";

export const BLOCK_VIEW_ACTION_COMMAND: LexicalCommand<{
  nodeKey: NodeKey;
  action: BlockViewAction;
}> = createCommand("BLOCK_VIEW_ACTION_COMMAND");

export function useBlockViewActions(
  nodeKey: NodeKey,
  handlers: Partial<Record<BlockViewAction, () => void>>,
) {
  const [editor] = useLexicalComposerContext();
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  useEffect(
    () =>
      editor.registerCommand(
        BLOCK_VIEW_ACTION_COMMAND,
        ({ nodeKey: target, action }) => {
          const handler = target === nodeKey ? handlersRef.current[action] : undefined;
          if (!handler) return false;
          handler();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, nodeKey],
  );
}

/** Opens the system file picker; `onFile` gets the chosen file, if any. */
export function chooseFile(accept: string | undefined, onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  if (accept) input.accept = accept;
  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      if (file) onFile(file);
    },
    { once: true },
  );
  input.click();
}
