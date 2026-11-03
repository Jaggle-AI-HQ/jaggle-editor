"use client";

import { useEffect, useRef } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $parseSerializedNode } from "lexical";

import { $replaceWithMarkdown, exportMarkdown } from "../lib/transfer";
import type { DocumentHandle } from "../lib/types";

import { revealInEditor } from "../plugins/floating/floating-utils";

import type { DocumentProvider } from "./collaboration";
import type { DocumentPersistence } from "./persistence";

/**
 * A remote cursor's caret: Lexical draws each one into its cursors container
 * (a `div` on the page's body) with the person's name as a label inside.
 */
function remoteCaret(document: Document, name: string): HTMLElement | null {
  for (const label of document.querySelectorAll<HTMLElement>("body > div > span > span")) {
    if (label.textContent === name && label.parentElement) return label.parentElement;
  }
  return null;
}

/**
 * Gives the page imperative access once the document is ready. Every change
 * goes through a normal editor update, so it is saved and reaches everyone in
 * the live room.
 */
export function DocumentHandlePlugin({
  ready,
  onReady,
  persistenceRef,
  providerRef,
}: {
  ready: boolean;
  onReady: (handle: DocumentHandle) => void;
  persistenceRef: { current: DocumentPersistence | null };
  /** The live room's provider, for finding someone's cursor. */
  providerRef: { current: DocumentProvider | null };
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
      revealPerson: (id) => {
        const awareness = providerRef.current?.ws.awareness;
        const root = editor.getRootElement();
        if (!awareness || !root) return false;
        const state = [...awareness.getStates().values()].find(
          (entry) => (entry as { awarenessData?: { id?: unknown } }).awarenessData?.id === id,
        ) as { name?: string } | undefined;
        const caret = state?.name ? remoteCaret(root.ownerDocument, state.name) : null;
        if (!caret) return false;
        revealInEditor(root, caret);
        return true;
      },
    });
  }, [editor, persistenceRef, providerRef, ready]);

  return null;
}
