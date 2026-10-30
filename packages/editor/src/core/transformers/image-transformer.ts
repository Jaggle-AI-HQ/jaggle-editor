import type { TextMatchTransformer } from "@lexical/markdown";

import { $createImageNode, $isImageNode, ImageNode } from "../nodes/image-node";

/** `![alt](src)`; for Markdown conversion only, not a typing shortcut. */
export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) =>
    $isImageNode(node) ? `![${node.getAltText()}](${node.getSrc()})` : null,
  importRegExp: /!\[([^[\]]*)\]\(([^()\s]+)\)/,
  regExp: /!\[([^[\]]*)\]\(([^()\s]+)\)$/,
  replace: (textNode, match) => {
    const [, altText = "", src = ""] = match;
    textNode.replace($createImageNode({ altText, src }));
  },
  trigger: ")",
  type: "text-match",
};
