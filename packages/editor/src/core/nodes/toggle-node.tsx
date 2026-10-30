import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

export type ToggleVariant = "heading" | "list";
export type ToggleLevel = 0 | 1 | 2 | 3;

export type SerializedToggleNode = Spread<
  {
    open: boolean;
    variant: ToggleVariant;
    level: ToggleLevel;
  },
  SerializedElementNode
>;

const TITLE_CLASS =
  "relative min-h-6 py-0.5 pl-6 outline-none before:absolute before:top-1/2 before:left-0 before:-translate-y-1/2 before:cursor-pointer before:text-muted-foreground before:content-['▸'] group-data-[open=true]:before:content-['▾']";

function titleClass(variant: ToggleVariant, level: ToggleLevel) {
  if (variant === "heading" && level === 1) {
    return `${TITLE_CLASS} text-3xl font-semibold tracking-tight`;
  }
  if (variant === "heading" && level === 2) {
    return `${TITLE_CLASS} text-2xl font-semibold tracking-tight`;
  }
  if (variant === "heading" && level === 3) {
    return `${TITLE_CLASS} text-xl font-semibold`;
  }
  return `${TITLE_CLASS} text-sm`;
}

function parseVariant(value: string | undefined): ToggleVariant {
  return value === "heading" ? "heading" : "list";
}

function parseLevel(value: string | undefined): ToggleLevel {
  const level = Number(value);
  return level === 1 || level === 2 || level === 3 ? level : 0;
}

/** Imports a `div` carrying `attribute` through `$convert`; other divs fall through. */
function divImport(
  attribute: string,
  $convert: (element: HTMLElement) => DOMConversionOutput,
): DOMConversionMap {
  return {
    div: (element: HTMLElement) =>
      element.hasAttribute(attribute)
        ? { conversion: $convert, priority: 2 }
        : null,
  };
}

export function $convertToggleElement(element: HTMLElement): DOMConversionOutput {
  return {
    node: $applyNodeReplacement(
      new ToggleNode(
        parseVariant(element.dataset.variant),
        parseLevel(element.dataset.level),
        element.dataset.open !== "false",
      ),
    ),
  };
}

export function $convertToggleTitleElement(): DOMConversionOutput {
  return { node: $createToggleTitleNode() };
}

export function $convertToggleContentElement(): DOMConversionOutput {
  return { node: $createToggleContentNode() };
}

export class ToggleNode extends ElementNode {
  __open: boolean;
  __variant: ToggleVariant;
  __level: ToggleLevel;

  static getType(): string {
    return "toggle";
  }

  static clone(node: ToggleNode): ToggleNode {
    return new ToggleNode(node.__variant, node.__level, node.__open, node.__key);
  }

  static importJSON(serialized: SerializedToggleNode): ToggleNode {
    return new ToggleNode(serialized.variant, serialized.level, serialized.open);
  }

  $config() {
    return this.config("toggle", {
      extends: ElementNode,
      importDOM: divImport("data-toggle", $convertToggleElement),
    });
  }

  constructor(
    variant: ToggleVariant,
    level: ToggleLevel,
    open = true,
    key?: NodeKey,
  ) {
    super(key);
    this.__variant = variant;
    this.__level = level;
    this.__open = open;
  }

  exportJSON(): SerializedToggleNode {
    const latest = this.getLatest();
    return {
      ...super.exportJSON(),
      open: latest.__open,
      variant: latest.__variant,
      level: latest.__level,
    };
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "group my-1";
    dom.dataset.open = this.__open ? "true" : "false";
    dom.dataset.variant = this.__variant;
    dom.dataset.level = String(this.__level);
    dom.setAttribute("data-toggle", "");
    return dom;
  }

  updateDOM(prev: ToggleNode, dom: HTMLElement): boolean {
    if (prev.__open !== this.__open) {
      dom.dataset.open = this.__open ? "true" : "false";
    }
    if (prev.__level !== this.__level) {
      dom.dataset.level = String(this.__level);
    }
    return false;
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): void {
    const writable = this.getWritable();
    writable.__open = open;
  }

  getVariant(): ToggleVariant {
    return this.getLatest().__variant;
  }

  getLevel(): ToggleLevel {
    return this.getLatest().__level;
  }

  /** Heading toggles only: their title's heading size (1–3). */
  setLevel(level: ToggleLevel): this {
    const writable = this.getWritable();
    writable.__level = level;
    return writable;
  }
}

export class ToggleTitleNode extends ElementNode {
  static getType(): string {
    return "toggle-title";
  }

  static clone(node: ToggleTitleNode): ToggleTitleNode {
    return new ToggleTitleNode(node.__key);
  }

  static importJSON(): ToggleTitleNode {
    return new ToggleTitleNode();
  }

  $config() {
    return this.config("toggle-title", {
      extends: ElementNode,
      importDOM: divImport("data-toggle-title", $convertToggleTitleElement),
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.setAttribute("data-toggle-title", "");
    const parent = this.getParent();
    dom.className = $isToggleNode(parent)
      ? titleClass(parent.getVariant(), parent.getLevel())
      : titleClass("list", 0);
    return dom;
  }

  updateDOM(prev: ToggleTitleNode, dom: HTMLElement): boolean {
    const parent = this.getParent();
    const prevParent = prev.getParent();
    if (parent === prevParent) return false;
    dom.className = $isToggleNode(parent)
      ? titleClass(parent.getVariant(), parent.getLevel())
      : titleClass("list", 0);
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }
}

export class ToggleContentNode extends ElementNode {
  static getType(): string {
    return "toggle-content";
  }

  static clone(node: ToggleContentNode): ToggleContentNode {
    return new ToggleContentNode(node.__key);
  }

  static importJSON(): ToggleContentNode {
    return new ToggleContentNode();
  }

  $config() {
    return this.config("toggle-content", {
      extends: ElementNode,
      importDOM: divImport("data-toggle-content", $convertToggleContentElement),
    });
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.setAttribute("data-toggle-content", "");
    dom.className = "group-data-[open=false]:hidden";
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

export function $createToggleNode(
  variant: ToggleVariant,
  level: ToggleLevel,
): ToggleNode {
  return $applyNodeReplacement(new ToggleNode(variant, level, true));
}

export function $createToggleTitleNode(): ToggleTitleNode {
  return $applyNodeReplacement(new ToggleTitleNode());
}

export function $createToggleContentNode(): ToggleContentNode {
  return $applyNodeReplacement(new ToggleContentNode());
}

export function $isToggleNode(
  node: LexicalNode | null | undefined,
): node is ToggleNode {
  return node instanceof ToggleNode;
}

export function $isToggleTitleNode(
  node: LexicalNode | null | undefined,
): node is ToggleTitleNode {
  return node instanceof ToggleTitleNode;
}

export function $isToggleContentNode(
  node: LexicalNode | null | undefined,
): node is ToggleContentNode {
  return node instanceof ToggleContentNode;
}

export function $createToggleBlock(
  variant: ToggleVariant,
  level: ToggleLevel,
  text: string,
): ToggleNode {
  const toggle = $createToggleNode(variant, level);
  const title = $createToggleTitleNode();
  if (text) title.append($createTextNode(text));
  const content = $createToggleContentNode();
  content.append($createParagraphNode());
  toggle.append(title, content);
  return toggle;
}
