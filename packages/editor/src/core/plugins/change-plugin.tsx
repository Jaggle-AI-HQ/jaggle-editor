"use client";

import { useEffect, useRef } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import type { DocumentChangeHandler } from "../lib/types";

/**
 * Reports the starting content once on mount, then content changes, with the
 * HTML a read-only view renders and the Lexical JSON. Debounced, and
 * selection-only updates are ignored, so typing does not export HTML on every
 * keystroke.
 */
export function ChangePlugin({
  onChange,
  delay = 300,
}: {
  onChange: DocumentChangeHandler;
  delay?: number;
}) {
  const [editor] = useLexicalComposerContext();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const emit = () => {
      const editorState = editor.getEditorState();
      const html = editorState.read(() => $generateHtmlFromNodes(editor, null));
      onChangeRef.current({ html, editorState: editorState.toJSON() });
    };
    emit();
    const unregister = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(emit, delay);
      },
    );
    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [delay, editor]);

  return null;
}
