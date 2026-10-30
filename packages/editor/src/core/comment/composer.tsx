"use client";

import { useEffect, useMemo, useState } from "react";

import { CodeExtension } from "@lexical/code";
import { HorizontalRuleExtension } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { $generateNodesFromDOM } from "@lexical/html";
import { LinkExtension } from "@lexical/link";
import { ListExtension } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ReactExtension } from "@lexical/react/ReactExtension";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import {
  $createParagraphNode,
  $getRoot,
  $insertNodes,
  configExtension,
  defineExtension,
  type LexicalEditor,
} from "lexical";

import { cn } from "../../lib/utils";

import { CommentToolbar } from "../components/comment-toolbar";
import { EditorErrorBoundary } from "../components/editor-error-boundary";
import { commentNodes } from "../lib/comment-nodes";
import { commentTheme } from "../lib/theme";
import type { LexicalEditorProps } from "../lib/types";
import { EmojiPickerPlugin } from "../plugins/emoji-picker-plugin";
import { MentionPlugin } from "../plugins/mention-plugin";
import { ShortcutsPlugin } from "../plugins/shortcuts-plugin";

import {
  splitCommentEditorState,
  splitCommentHtml,
} from "./attachment-content";
import { CommentAttachmentPreview } from "./attachment-preview";
import {
  CommentAttachmentUploadPlugin,
  useCommentAttachmentUpload,
} from "./attachment-upload-plugin";

function CommentAttachmentArea() {
  const { attachment, pending, cancelUpload, remove } = useCommentAttachmentUpload();
  if (attachment) {
    return <CommentAttachmentPreview attachment={attachment} onRemove={remove} />;
  }
  return pending ? (
    <CommentAttachmentPreview
      attachment={pending.attachment}
      progress={pending.progress}
      onRemove={cancelUpload}
    />
  ) : null;
}

function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.focus();
  }, [editor]);
  return null;
}

export default function CommentComposer({
  placeholder = "Add a comment...",
  imageScope,
  html,
  initialEditorState,
  containerClassName,
  autoFocus,
  actionLabel = "Send",
  cancelLabel = "Cancel",
  onCancel,
  onComment,
  mentionScope,
}: LexicalEditorProps) {
  const prepared = useMemo(() => {
    if (initialEditorState) {
      return { ...splitCommentEditorState(initialEditorState), html: undefined };
    }
    if (html && typeof DOMParser !== "undefined") {
      return { ...splitCommentHtml(html), editorState: undefined };
    }
    return { editorState: undefined, html, attachment: null };
  }, [html, initialEditorState]);
  const [extension] = useState(() =>
    defineExtension({
      name: "@jaggle/lexical/comment-composer",
      namespace: "JaggleComment",
      theme: commentTheme,
      dependencies: [
        RichTextExtension,
        HistoryExtension,
        ListExtension,
        LinkExtension,
        CodeExtension,
        HorizontalRuleExtension,
        configExtension(TableExtension, {
          hasCellMerge: false,
          hasCellBackgroundColor: false,
          hasHorizontalScroll: false,
        }),
        configExtension(ReactExtension, { ErrorBoundary: EditorErrorBoundary }),
      ],
      nodes: () => commentNodes,
      $initialEditorState: prepared.editorState
        ? JSON.stringify(prepared.editorState)
        : prepared.html
          ? (editor: LexicalEditor) => {
              if (typeof DOMParser === "undefined") return;
              const document = new DOMParser().parseFromString(
                prepared.html || "",
                "text/html",
              );
              const nodes = $generateNodesFromDOM(editor, document);
              const root = $getRoot();
              root.clear();
              root.select();
              $insertNodes(nodes);
              if (root.getChildrenSize() === 0) {
                root.append($createParagraphNode());
              }
            }
          : undefined,
    }),
  );

  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <CommentAttachmentUploadPlugin
        scope={imageScope}
        initialAttachment={prepared.attachment}
      >
        <div
          className={cn(
            "rounded-2xl m-2 border border-border bg-background transition-[border-color,box-shadow] focus-within:ring-2 focus-within:ring-border/40",
            containerClassName,
          )}
        >
          <div className="relative px-4 pt-3">
            <ContentEditable
              aria-placeholder={placeholder}
              placeholder={
                <div className="pointer-events-none absolute top-3 left-4 text-muted-foreground">
                  {placeholder}
                </div>
              }
              className="relative min-h-20 max-h-80 overflow-y-auto overscroll-contain leading-6 text-foreground outline-none"
            />
          </div>
          <CommentAttachmentArea />
          <CommentToolbar
            actionLabel={actionLabel}
            cancelLabel={cancelLabel}
            onCancel={onCancel}
            onComment={onComment}
            initialEditorState={prepared.editorState}
            initialHtml={prepared.html}
            initialAttachment={prepared.attachment}
          />
        </div>
      </CommentAttachmentUploadPlugin>
      {autoFocus ? <AutoFocusPlugin /> : null}
      <ShortcutsPlugin />
      <MentionPlugin scope={mentionScope} />
      <EmojiPickerPlugin />
    </LexicalExtensionComposer>
  );
}
