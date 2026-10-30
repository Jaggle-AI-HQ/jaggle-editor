"use client";

import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { IS_APPLE } from "@lexical/utils";
import {
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
} from "lexical";

import { OPEN_LINK_COMMAND } from "../lib/commands";

function hasMod(event: KeyboardEvent) {
  const mod = IS_APPLE ? event.metaKey : event.ctrlKey;
  return mod && !event.altKey;
}

export function ShortcutsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!hasMod(event)) return false;
        const key = event.key.toLowerCase();

        if (key === "e" && !event.shiftKey) {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          return true;
        }

        if (key === "m" && event.shiftKey) {
          event.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
          return true;
        }

        if (key === "k" && !event.shiftKey) {
          event.preventDefault();
          editor.dispatchCommand(OPEN_LINK_COMMAND, undefined);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
