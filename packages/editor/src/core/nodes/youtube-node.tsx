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
import { useBlockViewActions } from "../lib/block-commands";
import {
  alignFromFormat,
  exportBlockStyle,
  parseWidthPercent,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";

const YOUTUBE_ID =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[\w-=&]*?&)?v=|embed\/|shorts\/|live\/|v\/)|[?&]v=)([A-Za-z0-9_-]{11})/;

export function parseYouTubeVideoId(value: string): string | null {
  return YOUTUBE_ID.exec(value.trim())?.[1] ?? null;
}

export function isYouTubeUrl(value: string): boolean {
  return parseYouTubeVideoId(value) !== null;
}

export type SerializedYouTubeNode = Spread<
  {
    videoID: string;
    caption?: string;
    widthPercent?: number;
  },
  SerializedDecoratorBlockNode
>;

export function $convertYouTubeElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLIFrameElement)) {
    return null;
  }
  const videoID =
    domNode.getAttribute("data-lexical-youtube") ||
    parseYouTubeVideoId(domNode.getAttribute("src") ?? "");
  if (!videoID) {
    return null;
  }
  const node = $createYouTubeNode(videoID);
  node.setCaption(domNode.dataset.caption ?? null);
  node.setWidthPercent(parseWidthPercent(domNode.dataset.widthPercent));
  const align = domNode.dataset.align;
  if (align === "left" || align === "center" || align === "right") {
    node.setFormat(align);
  }
  return { node };
}

function YouTubeComponent({
  className,
  format,
  nodeKey,
  videoID,
  caption,
  widthPercent,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  videoID: string;
  caption: string | undefined;
  widthPercent: number | undefined;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(
    videoID ? `https://www.youtube.com/watch?v=${videoID}` : "",
  );

  const update = (change: (node: YouTubeNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) change(node);
    });
  };
  // "Change link" from the block menu shows the link field over the video.
  const [editingLink, setEditingLink] = useState(false);
  useBlockViewActions(nodeKey, {
    edit: () => {
      setDraft(`https://www.youtube.com/watch?v=${videoID}`);
      setEditingLink(true);
    },
  });

  const commit = () => {
    const nextId = parseYouTubeVideoId(draft);
    if (!nextId) {
      return;
    }
    setEditingLink(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) {
        node.setVideoID(nextId);
      }
    });
  };

  if (!videoID || editingLink) {
    return (
      <div
        contentEditable={false}
        className="my-3 flex flex-col gap-2 rounded-md border border-border p-3"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Input
          dir="ltr"
          value={draft}
          placeholder={t.youtubeUrlPlaceholder}
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
            disabled={!isEditable || !parseYouTubeVideoId(draft)}
            onClick={commit}
          >
            {editingLink ? t.saveLink : t.embedYoutube}
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
    <BlockWithAlignableContents
      className={{ base: className.base, focus: "" }}
      format={format}
      nodeKey={nodeKey}
    >
      <BlockFrame
        nodeKey={nodeKey}
        label={t.youtubeVideo}
        size={{ widthPercent }}
        align={alignFromFormat(format)}
        resizable={isEditable}
        onResize={(next) => update((node) => node.setWidthPercent(next))}
        onAlign={(next) => update((node) => node.setFormat(next))}
        caption={caption}
        onCaption={(next) => update((node) => node.setCaption(next))}
      >
        <iframe
          title={t.youtubeVideo}
          width="560"
          height="315"
          src={`https://www.youtube-nocookie.com/embed/${videoID}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="block aspect-video h-auto w-full max-w-full rounded-md border-0"
        />
      </BlockFrame>
    </BlockWithAlignableContents>
  );
}

export class YouTubeNode extends DecoratorBlockNode {
  __id: string;
  __caption: string | undefined;
  __widthPercent: number | undefined;

  $config() {
    return this.config("youtube", {
      extends: DecoratorBlockNode,
      importDOM: {
        iframe: () => ({ conversion: $convertYouTubeElement, priority: 1 }),
      },
    });
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(
      node.__id,
      node.__format,
      node.__key,
      node.__caption,
      node.__widthPercent,
    );
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    return $createYouTubeNode(serializedNode.videoID)
      .setFormat(serializedNode.format)
      .setCaption(serializedNode.caption ?? null)
      .setWidthPercent(parseWidthPercent(serializedNode.widthPercent));
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

  exportJSON(): SerializedYouTubeNode {
    return {
      ...super.exportJSON(),
      videoID: this.getId(),
      caption: this.getLatest().__caption,
      widthPercent: this.getLatest().__widthPercent,
    };
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption ?? undefined;
    return writable;
  }

  /** A width in percent, or undefined for Fit. */
  setWidthPercent(widthPercent: number | undefined): this {
    const writable = this.getWritable();
    writable.__widthPercent = widthPercent;
    return writable;
  }

  exportDOM(): DOMExportOutput {
    const element = $getDocument().createElement("iframe");
    element.setAttribute("data-lexical-youtube", this.__id);
    element.setAttribute("width", "560");
    element.setAttribute("height", "315");
    element.setAttribute(
      "src",
      `https://www.youtube-nocookie.com/embed/${this.__id}`,
    );
    element.setAttribute("frameborder", "0");
    element.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    );
    element.setAttribute("allowfullscreen", "true");
    element.setAttribute("title", "YouTube video");
    element.className =
      "my-3 block aspect-video h-auto w-full max-w-full rounded-md border-0";
    const align = alignFromFormat(this.__format);
    if (this.__widthPercent !== undefined) {
      element.setAttribute("data-width-percent", String(this.__widthPercent));
    }
    if (this.__caption !== undefined) {
      element.setAttribute("data-caption", this.__caption);
    }
    element.setAttribute("data-align", align);
    element.setAttribute(
      "style",
      `${exportBlockStyle({ widthPercent: this.__widthPercent }, align)};aspect-ratio:16/9;height:auto`,
    );
    return { element };
  }

  setVideoID(videoID: string): this {
    const writable = this.getWritable();
    writable.__id = videoID;
    return writable;
  }

  getId(): string {
    return this.getLatest().__id;
  }

  getTextContent(): string {
    const id = this.getId();
    return id ? `https://www.youtube.com/watch?v=${id}` : "";
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {};
    return (
      <YouTubeComponent
        className={{
          base: embedBlockTheme.base || "",
          focus: embedBlockTheme.focus || "",
        }}
        format={this.__format}
        nodeKey={this.getKey()}
        videoID={this.__id}
        caption={this.__caption}
        widthPercent={this.__widthPercent}
      />
    );
  }
}

export function $createYouTubeNode(videoID = ""): YouTubeNode {
  return $applyNodeReplacement(new YouTubeNode(videoID));
}

export function $isYouTubeNode(
  node: LexicalNode | null | undefined,
): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
