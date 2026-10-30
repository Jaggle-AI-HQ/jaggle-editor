import { $appendNodeToHTML } from "@lexical/html";
import {
  $create,
  $createParagraphNode,
  $createTextNode,
  $getDocument,
  $getSlot,
  $getSlotNames,
  $setSlot,
  addClassNamesToElement,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type SlotChildNode,
} from "lexical";

import { $createSlotContainerNode } from "./slot-container-node";

const DEFAULT_QUOTE =
  "The only way to discover the limits of the possible is to go beyond them into the impossible.";
const DEFAULT_ATTRIBUTION = "Arthur C. Clarke";

export class PullQuoteNode extends ElementNode {
  $config() {
    return this.config("pullquote", {
      extends: ElementNode,
      slots: ["quote", "attribution"],
    });
  }

  createDOM(config: EditorConfig): HTMLElement {
    const host = $getDocument().createElement("div");
    const className = config.theme.pullQuote;
    if (className) {
      addClassNamesToElement(host, className);
    }
    return host;
  }

  updateDOM(): false {
    return false;
  }

  isShadowRoot(): true {
    return true;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = $getDocument().createElement("div");
    element.setAttribute("data-lexical-pullquote", "true");
    // Read-only views render the export; theme.css styles the slots through this class.
    const className = editor._config.theme.pullQuote;
    if (className) {
      addClassNamesToElement(element, className);
    }
    for (const name of $getSlotNames(this)) {
      const slot = $getSlot(this, name);
      if (slot) {
        const wrapper = $getDocument().createElement("div");
        wrapper.setAttribute("data-lexical-slot", name);
        $appendNodeToHTML(editor, slot, wrapper);
        element.append(wrapper);
      }
    }
    return { element };
  }
}

export function $createPullQuoteNode(
  quote?: LexicalNode & SlotChildNode,
  attribution?: LexicalNode & SlotChildNode,
): PullQuoteNode {
  const node = $create(PullQuoteNode);
  $setSlot(
    node,
    "quote",
    quote ||
      $createSlotContainerNode().append(
        $createParagraphNode().append($createTextNode(DEFAULT_QUOTE)),
      ),
  );
  $setSlot(
    node,
    "attribution",
    attribution ||
      $createParagraphNode().append($createTextNode(DEFAULT_ATTRIBUTION)),
  );
  return node;
}

export function $isPullQuoteNode(
  node: LexicalNode | null | undefined,
): node is PullQuoteNode {
  return node instanceof PullQuoteNode;
}
