import {
  CoreImportExtension,
  defineImportRule,
  DOMImportExtension,
  sel,
} from "@lexical/html";
import { configExtension, defineExtension } from "lexical";

import { parseBoardColumns } from "../lib/board";
import { $createBoardNode, BoardNode } from "../nodes/board-node";

function $convertBoardElement(el: HTMLElement) {
  const columns = el.getAttribute("data-board-columns");
  if (columns === null) {
    return null;
  }
  try {
    return $createBoardNode(
      el.getAttribute("data-board-title") ?? "",
      parseBoardColumns(JSON.parse(columns)),
    );
  } catch {
    return null;
  }
}

const BoardImportRule = defineImportRule({
  $import: (_ctx, el, $next) => {
    const node = $convertBoardElement(el);
    return node ? [node] : $next();
  },
  match: sel.tag("div").attr("data-lexical-board", true),
  name: "@jaggle/lexical/board-import",
});

export const BoardExtension = defineExtension({
  name: "@jaggle/lexical/board",
  nodes: () => [BoardNode],
  dependencies: [
    CoreImportExtension,
    configExtension(DOMImportExtension, {
      rules: [BoardImportRule],
    }),
  ],
});
