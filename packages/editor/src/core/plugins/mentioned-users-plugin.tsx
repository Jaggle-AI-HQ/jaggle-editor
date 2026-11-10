"use client";

import { useEffect, useRef } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $nodesOfType, type EditorState } from "lexical";

import { MentionNode } from "../nodes/mention-node";

/** Ids of the people mentioned in an editor state, de-duplicated, in document order. */
export function mentionedUserIdsIn(editorState: EditorState): string[] {
  return editorState.read(() => {
    const ids = new Set<string>();
    for (const node of $nodesOfType(MentionNode)) {
      if (node.__entityType === "user" && node.__entityId) ids.add(node.__entityId);
    }
    return [...ids];
  });
}

/**
 * Reports who is @mentioned in the draft through `onChange`, only when the set
 * of people changes (so not on every keystroke). A cleared or sent draft
 * reports `[]`. A draft that starts with mentions reports them once on mount.
 */
export function MentionedUsersPlugin({
  onChange,
}: {
  onChange: (userIds: string[]) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let lastKey = "";
    const report = (editorState: EditorState) => {
      const ids = mentionedUserIdsIn(editorState);
      const key = [...ids].sort().join("\n");
      if (key === lastKey) return;
      lastKey = key;
      onChangeRef.current(ids);
    };
    report(editor.getEditorState());
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      report(editorState);
    });
  }, [editor]);

  return null;
}
