/**
 * The document editor without a view, for saved content: Markdown to the HTML
 * the editor saves, and the editor's export for pages that show a document
 * without opening it.
 */
export {
  createHeadlessDocumentEditor,
  documentHtmlFromMarkdown,
  exportDocumentHtml,
  type ExportServices,
} from "./core/document/headless";
