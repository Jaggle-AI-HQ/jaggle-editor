
import {
  $insertGeneratedNodes,
  ClipboardImportExtension,
} from "@lexical/clipboard";
import {
  HorizontalRuleExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import {
  $generateNodesFromDOMViaExtension,
  contextValue,
  ImportSource,
  ImportSourceDataTransfer,
} from "@lexical/html";
import { CheckListExtension, ListExtension } from "@lexical/list";
import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  registerMarkdownShortcuts,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getEditor,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  CONTROL_OR_META,
  configExtension,
  defineExtension,
  isExactShortcutMatch,
  KEY_DOWN_COMMAND,
  KEY_SPACE_COMMAND,
  RootNode,
  $hasUpdateTag,
  COLLABORATION_TAG,
  HISTORIC_TAG,
} from "lexical";

import { documentTheme } from "../lib/theme";
import { MentionNode } from "../nodes/mention-node";
import {
  ToggleContentNode,
  ToggleNode,
  ToggleTitleNode,
} from "../nodes/toggle-node";
import { ReactReviewExtension } from "../plugins/decorator/review-plugin";
import { HR } from "../transformers/horizontal-rule-transformer";
import { IMAGE } from "../transformers/image-transformer";
import { createTableTransformer } from "../transformers/table-transformer";

import { BoardExtension } from "./board";
import { CardExtension } from "./card";
import { CodeExtension } from "./code";
import { CollapsibleExtension } from "./collapsible";
import { CommentExtension } from "./comment";
import { ConversionImportExtension } from "./conversion-rules";
import { DateTimeExtension } from "./datetime";
import { EquationExtension } from "./equation";
import { FindReplaceExtension } from "./find-replace";
import { FormatStateExtension } from "./format-state";
import { ImageExtension } from "./image";
import { LayoutExtension } from "./layout";
import { LinkExtension, OPEN_LINK_EDITOR_COMMAND } from "./link";
import { MediaExtension } from "./media";
import { PollExtension } from "./poll";
import { PullQuoteExtension } from "./pullquote";
import { ShortcutsExtension } from "./shortcuts";
import { TweetExtension } from "./tweet";
import { YouTubeExtension } from "./youtube";

export const DOCUMENT_TRANSFORMERS: Transformer[] = [
  HR,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

/**
 * Markdown conversion (AI, import, and export): the shortcut transformers plus
 * GFM tables and images. Those two stay out of the typing shortcuts, so a line
 * starting with `|` is not turned into a table while typing.
 */
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  createTableTransformer(DOCUMENT_TRANSFORMERS),
  IMAGE,
  ...DOCUMENT_TRANSFORMERS,
];

export const DocumentExtension = defineExtension({
  name: "@jaggle/lexical/document",
  namespace: "JaggleDocument",
  dependencies: [
    RichTextExtension,
    HistoryExtension,
    ListExtension,
    CheckListExtension,
    LinkExtension,
    CodeExtension,
    EquationExtension,
    PollExtension,
    BoardExtension,
    ConversionImportExtension,
    // Pasted HTML goes through the rule-based importer, which knows every
    // document node; the default clipboard importer only knows classic importDOM.
    configExtension(ClipboardImportExtension, {
      $importMimeType: {
        "text/html": [
          (html, selection, _$next, dataTransfer) => {
            const dom = new DOMParser().parseFromString(html, "text/html");
            const nodes = $generateNodesFromDOMViaExtension(dom, {
              context: [
                contextValue(ImportSource, "paste"),
                contextValue(ImportSourceDataTransfer, dataTransfer),
              ],
            });
            $insertGeneratedNodes($getEditor(), nodes, selection);
            return true;
          },
        ],
      },
    }),
    configExtension(TableExtension, {
      hasHorizontalScroll: true,
    }),
    ImageExtension,
    MediaExtension,
    YouTubeExtension,
    TweetExtension,
    HorizontalRuleExtension,
    LayoutExtension,
    CardExtension,
    CollapsibleExtension,
    DateTimeExtension,
    PullQuoteExtension,
    ReactReviewExtension,
    CommentExtension,
    TabIndentationExtension,
    ShortcutsExtension,
    FormatStateExtension,
    FindReplaceExtension,
  ],
  nodes: () => [
    MentionNode,
    ToggleNode,
    ToggleTitleNode,
    ToggleContentNode,
  ],
  register: (editor) =>
    mergeRegister(
      // Keeps an empty line at the end to type into. Not for an empty root,
      // which only happens before a saved document loads (filling it would
      // stop the load), nor for changes from the live room or Yjs undo: the
      // client that made the change adds the line, so it isn't added twice.
      editor.registerNodeTransform(RootNode, (root) => {
        if (
          root.getChildrenSize() === 0 ||
          $hasUpdateTag(COLLABORATION_TAG) ||
          $hasUpdateTag(HISTORIC_TAG)
        ) {
          return;
        }
        const last = root.getLastChild();
        if ($isParagraphNode(last) && last.isEmpty()) {
          return;
        }
        root.append($createParagraphNode());
      }),
      registerMarkdownShortcuts(editor, DOCUMENT_TRANSFORMERS),
      editor.registerCommand(
        KEY_SPACE_COMMAND,
        (event) => {
          if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
          }
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const anchor = selection.anchor.getNode();
          const paragraph = $isParagraphNode(anchor)
            ? anchor
            : $findMatchingParent(anchor, $isParagraphNode);
          if (!paragraph?.isEmpty()) return false;
          event.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (
            !isExactShortcutMatch(event, "k", CONTROL_OR_META) ||
            !editor.dispatchCommand(OPEN_LINK_EDITOR_COMMAND, undefined)
          ) {
            return false;
          }
          // Global search listens for ⌘K on document.
          event.preventDefault();
          event.stopPropagation();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    ),
  theme: documentTheme,
});
