/**
 * Pieces for building a small editor of your own on Lexical's
 * `LexicalExtensionComposer` (for example sticky notes) that looks and
 * behaves like this one.
 */
export { EditorErrorBoundary } from "./core/components/editor-error-boundary";
export { ToolbarIconButton, ToolbarToggle } from "./core/components/toolbar-button";
export { $getActiveTextFormats } from "./core/extensions/format-state";
export { commentTheme, documentTheme, editorTheme } from "./core/lib/theme";
export {
  type CommentPayload,
  commentBody,
  mentionDraft,
  mentionedUserIds,
  toCommentPayload,
} from "./core/lib/comment-payload";
