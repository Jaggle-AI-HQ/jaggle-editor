/**
 * @jaggle-ai-hq/editor: Jaggle's Lexical editor. Wrap the app (or the part
 * with editors) in `EditorProvider` with its adapters, import the styles once
 * (see `styles.css`), then render `LexicalEditor`.
 */
export {
  DocumentExportDialog,
  IncompleteDocumentNotice,
  LexicalEditor,
  markdownToDocumentHtml,
  useDocumentUi,
  type CommentPayload,
  commentBody,
  mentionDraft,
  toCommentPayload,
} from "./core/index";
export type {
  CommentBody,
  CommentSubmitHandler,
  DocumentChangeHandler,
  DocumentHandle,
  DocumentHeader,
  DocumentSaveStatus,
  DocumentSource,
  ImageUploadScope,
  LexicalEditorProps,
} from "./core/index";
export { EditorProvider, useEditorAdapters } from "./adapters/context";
export type * from "./adapters/types";
