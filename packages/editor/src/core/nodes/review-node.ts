import { $appendNodeToHTML } from "@lexical/html";
import {
  $create,
  $createParagraphNode,
  $getDocument,
  $getEditor,
  $getSlot,
  $getState,
  $isElementNode,
  $markSlotEditable,
  $setSlot,
  $setState,
  addClassNamesToElement,
  createState,
  type DOMExportOutput,
  type EditorConfig,
  type ElementDOMSlot,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeStateVersion,
  setDOMUnmanaged,
  type StateConfigValue,
  type StateValueOrUpdater,
} from "lexical";

const ratingState = createState("rating", {
  parse: (v): number =>
    typeof v === "number" && v >= 0 && v <= 5 ? Math.round(v) : 0,
});

export class ReviewNode extends ElementNode {
  $config() {
    return this.config("review", {
      extends: ElementNode,
      slots: ["author"],
      stateConfigs: [{ flat: true, stateConfig: ratingState }],
    });
  }

  getRating(version?: NodeStateVersion): StateConfigValue<typeof ratingState> {
    return $getState(this, ratingState, version);
  }

  setRating(valueOrUpdater: StateValueOrUpdater<typeof ratingState>): this {
    return $setState(this, ratingState, valueOrUpdater);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const dom = $getDocument().createElement("div");
    const className = config.theme.review;
    if (className) {
      addClassNamesToElement(dom, className);
    }
    dom.contentEditable = "false";
    setDOMUnmanaged(dom);
    const children = $getDocument().createElement("div");
    children.className = "lexical-review-children";
    children.style.display = "none";
    $markSlotEditable(children, editor);
    dom.appendChild(children);
    return dom;
  }

  updateDOM(_prevNode: this, dom: HTMLElement): boolean {
    const children = dom.querySelector<HTMLElement>(".lexical-review-children");
    if (children !== null) {
      $markSlotEditable(children, $getEditor());
    }
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const childrenEl = element.querySelector<HTMLElement>(
      ".lexical-review-children",
    );
    const domSlot = super.getDOMSlot(element);
    return childrenEl !== null ? domSlot.withElement(childrenEl) : domSlot;
  }

  isShadowRoot(): true {
    return true;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const doc = $getDocument();
    const rating = this.getRating();
    const element = doc.createElement("div");
    element.setAttribute("data-lexical-review", "true");
    element.setAttribute("data-rating", String(rating));
    const className = editor._config.theme.review;
    if (className) {
      addClassNamesToElement(element, className);
    }
    // Static stars for read-only views. Import skips this element and reads data-rating.
    const stars = doc.createElement("span");
    stars.setAttribute("data-lexical-review-stars", "");
    stars.setAttribute("aria-label", `Rating: ${rating} of 5`);
    stars.className = "mb-1 block text-lg leading-none tracking-wider text-amber-500";
    stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    element.append(stars);
    const author = $getSlot(this, "author");
    if (!$isElementNode(author)) {
      return { element };
    }
    const wrapper = doc.createElement("div");
    wrapper.setAttribute("data-lexical-slot", "author");
    wrapper.className = "mt-1 text-sm text-muted-foreground";
    $appendNodeToHTML(editor, author, wrapper);
    // The body children are appended after exportDOM; the author line goes last,
    // as in the editor.
    return {
      element,
      after: (generated) => {
        generated?.appendChild(wrapper);
        return generated;
      },
    };
  }
}

export function $createReviewNode(): ReviewNode {
  const node = $create(ReviewNode);
  $setSlot(node, "author", $createParagraphNode());
  node.append($createParagraphNode());
  return node;
}

export function $isReviewNode(
  node: LexicalNode | null | undefined,
): node is ReviewNode {
  return node instanceof ReviewNode;
}
