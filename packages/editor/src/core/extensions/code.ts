import {
  $createCodeNode,
  $isCodeHighlightNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeIndentExtension,
  CodeNode,
} from "@lexical/code";
import { CodeShikiExtension, ShikiTokenizer, type Tokenizer } from "@lexical/code-shiki";
import { $setBlocksType, getStyleObjectFromCSS } from "@lexical/selection";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  configExtension,
  defineExtension,
  type LexicalEditor,
  mergeRegister,
  type NodeKey,
  type NodeMutation,
} from "lexical";

export function insertCodeBlock(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection() ?? $getRoot().selectEnd();
    if (!$isRangeSelection(selection)) {
      return;
    }

    if ($isCodeNode(selection.anchor.getNode().getTopLevelElement())) {
      return;
    }

    if (selection.isCollapsed()) {
      $setBlocksType(selection, () => $createCodeNode());
      return;
    }

    const textContent = selection.getTextContent();
    const codeNode = $createCodeNode();
    selection.insertNodes([codeNode]);

    const updatedSelection = $getSelection();
    if ($isRangeSelection(updatedSelection)) {
      updatedSelection.insertRawText(textContent);
    }
  });
}

const LIGHT_CODE_THEME = "github-light";
const DARK_CODE_THEME = "github-dark";

/**
 * github-light and github-dark colour the same scopes, so every colour of one
 * has a twin in the other: [light, dark]. Where a colour has two twins the
 * first wins (light #032f62 is #9ecbff for strings and #dbedff for regexps).
 */
export const CODE_THEME_COLORS: [light: string, dark: string][] = [
  ["#24292e", "#e1e4e8"],
  ["#6a737d", "#6a737d"],
  ["#005cc5", "#79b8ff"],
  ["#6f42c1", "#b392f0"],
  ["#22863a", "#85e89d"],
  ["#d73a49", "#f97583"],
  ["#032f62", "#9ecbff"],
  ["#032f62", "#dbedff"],
  ["#e36209", "#ffab70"],
  ["#b31d28", "#fdaeb7"],
  ["#fafbfc", "#24292e"],
  ["#f6f8fa", "#2f363d"],
  ["#586069", "#d1d5da"],
];

function twins(from: 0 | 1) {
  const map = new Map<string, string>();
  for (const pair of CODE_THEME_COLORS) {
    if (!map.has(pair[from])) {
      map.set(pair[from], pair[1 - from]);
    }
  }
  return map;
}

const DARK_BY_LIGHT = twins(0);
const LIGHT_BY_DARK = twins(1);

/** The node's text colour in light and dark mode, from the theme its block was highlighted with. */
function $codeColors(node: CodeNode | CodeHighlightNode): [string, string] | null {
  const codeNode = $isCodeNode(node) ? node : node.getParent();
  const color = getStyleObjectFromCSS(node.getStyle()).color?.toLowerCase();
  if (!$isCodeNode(codeNode) || !color) {
    return null;
  }
  switch (codeNode.getTheme()) {
    case LIGHT_CODE_THEME: {
      const dark = DARK_BY_LIGHT.get(color);
      return dark ? [color, dark] : null;
    }
    case DARK_CODE_THEME: {
      const light = LIGHT_BY_DARK.get(color);
      return light ? [light, color] : null;
    }
    default:
      return null;
  }
}

/**
 * The colours are inline styles on the nodes, so they are part of the shared
 * document. New blocks are always highlighted with github-light, whoever
 * writes them; blocks saved by older versions may be github-dark.
 */
const tokenizer: Tokenizer = {
  ...ShikiTokenizer,
  defaultTheme: LIGHT_CODE_THEME,
};

export const CodeExtension = defineExtension({
  name: "@jaggle/lexical/code",
  dependencies: [
    configExtension(CodeShikiExtension, { tokenizer }),
    configExtension(CodeIndentExtension, {
      tabSize: 2,
      escapeWithArrows: true,
    }),
  ],
  register: (editor) => {
    // Each viewer's mode is applied when rendering: the DOM gets both colours
    // and styles.css picks one, so switching modes writes nothing to the document.
    const paintCodeColors = (mutations: Map<NodeKey, NodeMutation>) => {
      editor.read("latest", () => {
        for (const [key, mutation] of mutations) {
          const element = editor.getElementByKey(key);
          const node = $getNodeByKey(key);
          if (mutation === "destroyed" || !element) {
            continue;
          }
          const colors =
            $isCodeNode(node) || $isCodeHighlightNode(node) ? $codeColors(node) : null;
          if (colors) {
            element.style.setProperty("--lexical-code-light", colors[0]);
            element.style.setProperty("--lexical-code-dark", colors[1]);
          } else {
            element.style.removeProperty("--lexical-code-light");
            element.style.removeProperty("--lexical-code-dark");
          }
        }
      });
    };

    return mergeRegister(
      editor.registerMutationListener(CodeNode, paintCodeColors, {
        skipInitialization: false,
      }),
      editor.registerMutationListener(CodeHighlightNode, paintCodeColors, {
        skipInitialization: false,
      }),
    );
  },
});
