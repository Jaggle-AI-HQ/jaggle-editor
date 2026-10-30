"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { SmileIcon } from "lucide-react";

import { useTranslation } from "../lib/locale";
import { insertEmojiTrigger } from "../plugins/emoji-picker-plugin";

import { ToolbarIconButton } from "./toolbar-button";

export function EmojiButton() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  return (
    <ToolbarIconButton
      label={t.insertEmoji}
      onClick={() => insertEmojiTrigger(editor)}
    >
      <SmileIcon />
    </ToolbarIconButton>
  );
}
