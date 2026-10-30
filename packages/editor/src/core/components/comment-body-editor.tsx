"use client";

import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { HistoryExtension } from "@lexical/history";
import { $generateHtmlFromNodes } from "@lexical/html";
import { LinkExtension } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ReactExtension } from "@lexical/react/ReactExtension";
import { RichTextExtension } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  configExtension,
  defineExtension,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  mergeRegister,
} from "lexical";

import { cn } from "../../lib/utils";

import { commentTheme } from "../lib/theme";
import type { CommentBody } from "../lib/types";
import { MentionNode } from "../nodes/mention-node";
import { MentionPlugin } from "../plugins/mention-plugin";

import { EditorErrorBoundary } from "./editor-error-boundary";

export type CommentBodyEditorHandle = {
  submit: () => void;
  focus: () => void;
};

const commentBodyExtension = defineExtension({
  name: "@jaggle/lexical/comment-body",
  namespace: "JaggleCommentBody",
  theme: commentTheme,
  dependencies: [
    RichTextExtension,
    HistoryExtension,
    LinkExtension,
    configExtension(ReactExtension, { ErrorBoundary: EditorErrorBoundary }),
  ],
  nodes: () => [MentionNode],
});

function readBody(editor: LexicalEditor): CommentBody | null {
  const editorState = editor.getEditorState();
  return editorState.read(() => {
    // A mention counts as content: its text is the mentioned title.
    const text = $getRoot().getTextContent().trim();
    if (text === "") {
      return null;
    }
    return {
      format: "lexical" as const,
      state: editorState.toJSON(),
      html: $generateHtmlFromNodes(editor, null),
      text,
    };
  });
}

function CommentBodyKeys({
  handleRef,
  autoFocus,
  onSubmit,
  onCancel,
  onEmptyChange,
}: {
  handleRef?: Ref<CommentBodyEditorHandle>;
  autoFocus: boolean;
  onSubmit: (body: CommentBody) => void;
  onCancel?: () => void;
  onEmptyChange?: (empty: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  // Latest callbacks, so the key handlers register once per editor.
  const callbacksRef = useRef({ onSubmit, onCancel, onEmptyChange });
  useEffect(() => {
    callbacksRef.current = { onSubmit, onCancel, onEmptyChange };
  }, [onSubmit, onCancel, onEmptyChange]);

  const submit = useCallback(() => {
    const body = readBody(editor);
    if (!body) {
      return;
    }
    callbacksRef.current.onSubmit(body);
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
      root.selectEnd();
    });
  }, [editor]);

  useImperativeHandle(
    handleRef,
    () => ({ submit, focus: () => editor.focus() }),
    [editor, submit],
  );

  useEffect(() => {
    if (autoFocus) {
      editor.focus();
    }
  }, [autoFocus, editor]);

  useEffect(
    () =>
      mergeRegister(
        // The mention menu handles Enter and Escape first (critical priority)
        // while it is open.
        editor.registerCommand(
          KEY_ENTER_COMMAND,
          (event) => {
            if (event?.shiftKey) {
              return false;
            }
            event?.preventDefault();
            submit();
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          (event) => {
            const { onCancel: cancel } = callbacksRef.current;
            if (!cancel) {
              return false;
            }
            event.preventDefault();
            cancel();
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerUpdateListener(({ editorState }) => {
          callbacksRef.current.onEmptyChange?.(
            editorState.read(() => $getRoot().getTextContent().trim() === ""),
          );
        }),
      ),
    [editor, submit],
  );

  return null;
}

/**
 * The comment field for document threads (add comment popover and replies).
 * Enter posts, Shift+Enter adds a line, Escape cancels, and `@` mentions people
 * and records through the same mention menu and node as the document.
 */
export function CommentBodyEditor({
  ref,
  placeholder,
  initialBody,
  autoFocus = false,
  className,
  onSubmit,
  onCancel,
  onEmptyChange,
}: {
  ref?: Ref<CommentBodyEditorHandle>;
  placeholder: string;
  /** Existing comment to edit. Read once. */
  initialBody?: CommentBody;
  autoFocus?: boolean;
  className?: string;
  onSubmit: (body: CommentBody) => void;
  onCancel?: () => void;
  onEmptyChange?: (empty: boolean) => void;
}) {
  const [extension] = useState(() =>
    initialBody
      ? defineExtension({
          name: "@jaggle/lexical/comment-body-edit",
          dependencies: [commentBodyExtension],
          $initialEditorState: JSON.stringify(initialBody.state),
        })
      : commentBodyExtension,
  );
  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <div className="relative">
        <ContentEditable
          aria-label={placeholder}
          aria-placeholder={placeholder}
          placeholder={
            <div className="pointer-events-none absolute inset-0 truncate px-2.5 py-1.5 text-muted-foreground/70 select-none">
              {placeholder}
            </div>
          }
          className={cn(
            "max-h-40 min-h-8 overflow-y-auto px-2.5 py-1.5 outline-none [&_p]:m-0",
            className,
          )}
        />
      </div>
      <MentionPlugin />
      <CommentBodyKeys
        handleRef={ref}
        autoFocus={autoFocus}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onEmptyChange={onEmptyChange}
      />
    </LexicalExtensionComposer>
  );
}
