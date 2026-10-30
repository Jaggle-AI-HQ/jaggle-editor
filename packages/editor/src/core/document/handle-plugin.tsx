"use client";

import { useEffect, useRef } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $parseSerializedNode } from "lexical";

import { $replaceWithMarkdown, exportMarkdown } from "../lib/transfer";
import type { DocumentHandle } from "../lib/types";

import type { DocumentPersistence } from "./persistence";

/**
 * Gives the page imperative access once the document is ready. Every change
 * goes through a normal editor update, so it is saved and reaches everyone in
 * the live room.
 */
export function DocumentHandlePlugin({
  ready,
  onReady,
  persistenceRef,
}: {
  ready: boolean;
  onReady: (handle: DocumentHandle) => void;
  persistenceRef: { current: DocumentPersistence | null };
}) {
  const [editor] = useLexicalComposerContext();
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!ready) return;
    onReadyRef.current({
      replaceWithMarkdown: (markdown) => {
        editor.update(() => $replaceWithMarkdown(markdown));
      },
      getMarkdown: () => exportMarkdown(editor),
      getHtml: () =>
        editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null)),
      snapshot: () => editor.getEditorState().toJSON(),
      restore: (state) => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          root.append(...state.root.children.map((child) => $parseSerializedNode(child)));
        });
      },
      flush: () => persistenceRef.current?.flush() ?? Promise.resolve(),
    });
  }, [editor, persistenceRef, ready]);

  return null;
}
