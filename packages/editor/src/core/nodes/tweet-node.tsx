"use client";

import { useState, type JSX } from "react";

import { BlockWithAlignableContents } from "@lexical/react/LexicalBlockWithAlignableContents";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  DecoratorBlockNode,
  type SerializedDecoratorBlockNode,
} from "@lexical/react/LexicalDecoratorBlockNode";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $applyNodeReplacement,
  $getDocument,
  $getNodeByKey,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type ElementFormatType,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type Spread,
} from "lexical";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

import { BlockFrame } from "../components/block-frame";
import { TweetEmbed } from "../components/tweet-embed";
import { useBlockViewActions } from "../lib/block-commands";
import {
  alignFromFormat,
  parseWidthPercent,
  TWEET_MAX_PX,
  TWEET_MIN_PX,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";

const TWEET_STATUS =
  /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/(\d+)/i;

export function tweetStatusId(url: string) {
  return TWEET_STATUS.exec(url.trim())?.[1] ?? null;
}

export function parseTweetId(value: string) {
  const trimmed = value.trim();
  return tweetStatusId(trimmed) ?? (/^\d+$/.test(trimmed) ? trimmed : null);
}

export function isTweetStatusUrl(value: string) {
  return /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/\s]+\/status\/\d+(?:\?\S*)?$/i.test(
    value.trim(),
  );
}

export type SerializedTweetNode = Spread<
  {
    id: string;
    url?: string;
    caption?: string;
    widthPercent?: number;
  },
  SerializedDecoratorBlockNode
>;

function TweetWidget({
  className,
  format,
  nodeKey,
  tweetID,
  caption,
  widthPercent,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  tweetID: string;
  caption: string | undefined;
  widthPercent: number | undefined;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const update = (change: (node: TweetNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTweetNode(node)) change(node);
    });
  };

  return (
    <BlockWithAlignableContents
      className={{ base: className.base, focus: "" }}
      format={format}
      nodeKey={nodeKey}
    >
      <BlockFrame
        nodeKey={nodeKey}
        label={t.tweetPost}
        size={{ widthPercent, minPx: TWEET_MIN_PX, maxPx: TWEET_MAX_PX }}
        align={alignFromFormat(format)}
        resizable={isEditable}
        onResize={(next) => update((node) => node.setWidthPercent(next))}
        onAlign={(next) => update((node) => node.setFormat(next))}
        caption={caption}
        onCaption={(next) => update((node) => node.setCaption(next))}
      >
        <TweetEmbed tweetID={tweetID} />
      </BlockFrame>
    </BlockWithAlignableContents>
  );
}

function TweetComponent({
  className,
  format,
  nodeKey,
  tweetID,
  caption,
  widthPercent,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  tweetID: string;
  caption: string | undefined;
  widthPercent: number | undefined;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  // "Change link" from the block menu shows the link field over the post.
  const [editingLink, setEditingLink] = useState(false);
  useBlockViewActions(nodeKey, {
    edit: () => {
      setDraft(`https://x.com/i/web/status/${tweetID}`);
      setEditingLink(true);
    },
  });

  const commit = () => {
    const nextId = parseTweetId(draft);
    if (!nextId) {
      return;
    }
    setEditingLink(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTweetNode(node)) {
        node.setId(nextId);
      }
    });
  };

  if (!tweetID || editingLink) {
    return (
      <div
        contentEditable={false}
        className="my-3 flex flex-col gap-2 rounded-md border border-border p-3"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Input
          dir="ltr"
          value={draft}
          placeholder={t.tweetUrlPlaceholder}
          disabled={!isEditable}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape" && editingLink) {
              event.preventDefault();
              setEditingLink(false);
            }
          }}
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!isEditable || !parseTweetId(draft)}
            onClick={commit}
          >
            {editingLink ? t.saveLink : t.embedTweet}
          </Button>
          {editingLink ? (
            <Button variant="ghost" onClick={() => setEditingLink(false)}>
              {t.cancel}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <TweetWidget
      key={tweetID}
      className={className}
      format={format}
      nodeKey={nodeKey}
      tweetID={tweetID}
      caption={caption}
      widthPercent={widthPercent}
    />
  );
}

export function $convertTweetElement(element: HTMLElement): DOMConversionOutput | null {
  const id = element.getAttribute("data-lexical-tweet-id");
  if (!id) return null;
  const node = $createTweetNode(id);
  node.setCaption(element.dataset.caption ?? null);
  node.setWidthPercent(parseWidthPercent(element.dataset.widthPercent));
  const align = element.dataset.align;
  if (align === "left" || align === "center" || align === "right") {
    node.setFormat(align);
  }
  return { node };
}

export class TweetNode extends DecoratorBlockNode {
  __id: string;
  __caption: string | undefined;
  __widthPercent: number | undefined;

  $config() {
    return this.config("tweet", {
      extends: DecoratorBlockNode,
      importDOM: {
        div: (element: HTMLElement) =>
          element.hasAttribute("data-lexical-tweet-id")
            ? { conversion: $convertTweetElement, priority: 2 }
            : null,
      },
    });
  }

  static clone(node: TweetNode): TweetNode {
    return new TweetNode(
      node.__id,
      node.__format,
      node.__key,
      node.__caption,
      node.__widthPercent,
    );
  }

  static importJSON(serialized: SerializedTweetNode): TweetNode {
    const id = serialized.id || parseTweetId(serialized.url ?? "") || "";
    return $createTweetNode(id)
      .setFormat(serialized.format)
      .setCaption(serialized.caption ?? null)
      .setWidthPercent(parseWidthPercent(serialized.widthPercent));
  }

  constructor(
    id = "",
    format?: ElementFormatType,
    key?: NodeKey,
    caption?: string,
    widthPercent?: number,
  ) {
    super(format, key);
    this.__id = id;
    this.__caption = caption;
    this.__widthPercent = widthPercent;
  }

  exportJSON(): SerializedTweetNode {
    return {
      ...super.exportJSON(),
      id: this.getId(),
      caption: this.getLatest().__caption,
      widthPercent: this.getLatest().__widthPercent,
    };
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption ?? undefined;
    return writable;
  }

  /** A width in percent, or undefined for Fit (X's widest, 550 px). */
  setWidthPercent(widthPercent: number | undefined): this {
    const writable = this.getWritable();
    writable.__widthPercent = widthPercent;
    return writable;
  }

  exportDOM(): DOMExportOutput {
    const doc = $getDocument();
    const element = doc.createElement("div");
    element.setAttribute("data-lexical-tweet-id", this.__id);
    const align = alignFromFormat(this.__format);
    if (this.__widthPercent !== undefined) {
      element.setAttribute("data-width-percent", String(this.__widthPercent));
    }
    if (this.__caption !== undefined) {
      element.setAttribute("data-caption", this.__caption);
    }
    element.setAttribute("data-align", align);
    const url = this.getTextContent();
    if (url) {
      // Read-only views have no widget script; a link keeps the post reachable.
      const link = doc.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.textContent = url;
      element.append(link);
    }
    return { element };
  }

  setId(id: string): this {
    const writable = this.getWritable();
    writable.__id = id;
    return writable;
  }

  getId(): string {
    return this.getLatest().__id;
  }

  getTextContent(): string {
    const id = this.getId();
    return id ? `https://x.com/i/web/status/${id}` : "";
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {};
    return (
      <TweetComponent
        className={{
          base: embedBlockTheme.base || "",
          focus: embedBlockTheme.focus || "",
        }}
        format={this.__format}
        nodeKey={this.getKey()}
        tweetID={this.__id}
        caption={this.__caption}
        widthPercent={this.__widthPercent}
      />
    );
  }
}

export function $createTweetNode(tweetID = ""): TweetNode {
  return $applyNodeReplacement(new TweetNode(tweetID));
}

export function $isTweetNode(
  node: LexicalNode | null | undefined,
): node is TweetNode {
  return node instanceof TweetNode;
}
