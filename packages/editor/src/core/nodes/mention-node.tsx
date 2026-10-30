import type { JSX } from "react";

import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

import { MentionChip } from "../components/mention-chip";

export type SerializedMentionNode = Spread<
  {
    entityType: string;
    entityId: string;
    title: string;
    href: string;
  },
  SerializedLexicalNode
>;

export type MentionPayload = {
  entityType: string;
  entityId: string;
  title: string;
  href?: string;
};

export function $convertMentionElement(element: HTMLElement): DOMConversionOutput | null {
  const entityType = element.getAttribute("data-entity-type");
  const entityId = element.getAttribute("data-entity-id");
  if (!entityType || !entityId) {
    return null;
  }
  const title =
    element.getAttribute("data-title") ??
    (element.textContent ?? "").replace(/^@/, "");
  return {
    node: $createMentionNode({
      entityType,
      entityId,
      title,
      href: element.getAttribute("data-href") ?? undefined,
    }),
  };
}

export class MentionNode extends DecoratorNode<JSX.Element> {
  __entityType: string;
  __entityId: string;
  __title: string;
  __href: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__entityType,
      node.__entityId,
      node.__title,
      node.__href,
      node.__key,
    );
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode(serialized);
  }

  $config() {
    return this.config("mention", {
      extends: DecoratorNode,
      importDOM: {
        span: (element: HTMLElement) =>
          element.hasAttribute("data-lexical-mention")
            ? { conversion: $convertMentionElement, priority: 2 }
            : null,
      },
    });
  }

  constructor(
    entityType: string,
    entityId: string,
    title: string,
    href = "",
    key?: NodeKey,
  ) {
    super(key);
    this.__entityType = entityType;
    this.__entityId = entityId;
    this.__title = title;
    this.__href = href;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      entityType: this.getLatest().__entityType,
      entityId: this.getLatest().__entityId,
      title: this.getLatest().__title,
      href: this.getLatest().__href,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    const latest = this.getLatest();
    element.setAttribute("data-lexical-mention", "");
    element.setAttribute("data-entity-type", latest.__entityType);
    element.setAttribute("data-entity-id", latest.__entityId);
    element.setAttribute("data-title", latest.__title);
    if (latest.__href) element.setAttribute("data-href", latest.__href);
    // Read-only views render the chip itself; this is the fallback for
    // exports, with "@" before people.
    element.className = "font-medium";
    element.textContent =
      latest.__entityType === "user" ? `@${latest.__title}` : latest.__title;
    return { element };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  getTextContent(): string {
    return this.getLatest().__title;
  }

  decorate(): JSX.Element {
    const latest = this.getLatest();
    return (
      <MentionChip
        entityType={latest.__entityType}
        entityId={latest.__entityId}
        title={latest.__title}
        href={latest.__href}
      />
    );
  }
}

export function $createMentionNode(payload: MentionPayload): MentionNode {
  return $applyNodeReplacement(
    new MentionNode(
      payload.entityType,
      payload.entityId,
      payload.title,
      payload.href ?? "",
    ),
  );
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
