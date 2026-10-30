"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";

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
  createCommand,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type ElementFormatType,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type Spread,
} from "lexical";
import { AudioLines, FileUp, Film, Loader2 } from "lucide-react";

import { BlockFrame } from "../components/block-frame";
import { downloadMediaFile } from "../components/media-hover-menu";
import { MediaInsertPlaceholder } from "../components/media-insert-placeholder";
import {
  AudioCard,
  FileCard,
  MediaFailed,
  useInlineFileUrl,
} from "../components/media-view";
import { UploadingMedia } from "../components/upload-state";
import { chooseFile, useBlockViewActions } from "../lib/block-commands";
import {
  alignFromFormat,
  exportBlockStyle,
  parseWidthPercent,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";
import { useFreshPlaceholder, useNodeUpload } from "../lib/upload-registry";

import { $createYouTubeNode, parseYouTubeVideoId } from "./youtube-node";

export type MediaPayload = {
  attachmentId?: string;
  caption?: string;
  mimeType?: string;
  name: string;
  src: string;
};

export const REPLACE_FILE_COMMAND: LexicalCommand<{
  file: File;
  nodeKey: NodeKey;
}> = createCommand("REPLACE_FILE_COMMAND");

// Decorator views render in a portal, outside upload plugin React contexts.
export const UPLOAD_MEDIA_TO_NODE_COMMAND: LexicalCommand<{
  file: File;
  kind: "video" | "audio" | "file";
  nodeKey: NodeKey;
  onComplete: (success: boolean) => void;
}> = createCommand("UPLOAD_MEDIA_TO_NODE_COMMAND");

export type SerializedMediaNode = Spread<
  MediaPayload,
  SerializedDecoratorBlockNode
>;

export type SerializedVideoNode = Spread<
  MediaPayload & { width?: number; height?: number; widthPercent?: number },
  SerializedDecoratorBlockNode
>;

function $payloadFromDataset(
  element: HTMLElement,
  src: string,
): MediaPayload | null {
  if (!src || src.startsWith("file:///")) {
    return null;
  }
  return {
    src,
    name: element.getAttribute("data-name") || element.getAttribute("title") || "File",
    caption: element.dataset.caption,
    attachmentId: element.dataset.attachmentId || undefined,
    mimeType: element.getAttribute("data-mime-type") || undefined,
  };
}

export function $convertVideoElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLVideoElement)) {
    return null;
  }
  const src =
    domNode.getAttribute("data-lexical-video") ||
    domNode.getAttribute("src") ||
    "";
  const payload = $payloadFromDataset(domNode, src);
  if (!payload) return null;
  const node = $createVideoNode(payload);
  const widthPercent = parseWidthPercent(domNode.dataset.widthPercent);
  if (widthPercent !== undefined) {
    node.setWidthPercent(widthPercent);
  } else {
    const width = Number(domNode.getAttribute("width"));
    const height = Number(domNode.getAttribute("height"));
    node.setWidthAndHeight(
      width > 0 ? width : "inherit",
      height > 0 ? height : "inherit",
    );
  }
  const align = domNode.dataset.align;
  if (align === "left" || align === "center" || align === "right") {
    node.setFormat(align);
  }
  return { node };
}

export function $convertAudioElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLAudioElement)) {
    return null;
  }
  const src =
    domNode.getAttribute("data-lexical-audio") ||
    domNode.getAttribute("src") ||
    "";
  const payload = $payloadFromDataset(domNode, src);
  return payload ? { node: $createAudioNode(payload) } : null;
}

export function $convertFileElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLAnchorElement)) {
    return null;
  }
  if (!domNode.hasAttribute("data-lexical-file")) {
    return null;
  }
  const src = domNode.getAttribute("href") || "";
  const payload = $payloadFromDataset(domNode, src);
  return payload ? { node: $createFileNode(payload) } : null;
}

function writeMediaAttributes(
  element: HTMLElement,
  node: {
    __src: string;
    __name: string;
    __attachmentId?: string;
    __caption?: string;
    __mimeType?: string;
  },
  srcAttr: "src" | "href",
) {
  element.setAttribute(srcAttr, node.__src);
  element.setAttribute("data-name", node.__name);
  if (node.__attachmentId) {
    element.setAttribute("data-attachment-id", node.__attachmentId);
  }
  if (node.__mimeType) {
    element.setAttribute("data-mime-type", node.__mimeType);
  }
  if (node.__caption !== undefined) {
    element.setAttribute("data-caption", node.__caption);
  }
}

function MediaFrame({
  className,
  format,
  nodeKey,
  children,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  children: ReactNode;
}) {
  return (
    <BlockWithAlignableContents
      className={className}
      format={format}
      nodeKey={nodeKey}
    >
      {children}
    </BlockWithAlignableContents>
  );
}

function PendingMedia({
  kind,
  nodeKey,
}: {
  kind: "video" | "audio" | "file";
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const freshPlaceholder = useFreshPlaceholder(nodeKey);

  if (!isEditable) return <MediaFailed label={t.mediaLoadError} />;

  const config = {
    video: {
      icon: <Film className="size-5" />,
      label: t.mediaVideoPlaceholder,
      accept: "video/*",
    },
    audio: {
      icon: <AudioLines className="size-5" />,
      label: t.mediaAudioPlaceholder,
      accept: "audio/*",
    },
    file: {
      icon: <FileUp className="size-5" />,
      label: t.mediaFilePlaceholder,
      accept: undefined,
      hint: t.mediaFileFormats,
    },
  }[kind];

  return (
    <MediaInsertPlaceholder
      {...config}
      defaultOpen={freshPlaceholder}
      onUpload={(file) =>
        new Promise<boolean>((resolve) => {
          if (
            !editor.dispatchCommand(UPLOAD_MEDIA_TO_NODE_COMMAND, {
              file,
              kind,
              nodeKey,
              onComplete: resolve,
            })
          ) {
            resolve(false);
          }
        })
      }
      onLink={(src) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (!($isVideoNode(node) || $isAudioNode(node) || $isFileNode(node))) {
            return;
          }
          if (kind === "video") {
            const videoId = parseYouTubeVideoId(src);
            if (videoId) {
              node.replace($createYouTubeNode(videoId));
              return;
            }
          }
          const url = new URL(src);
          const name =
            url.pathname.split("/").filter(Boolean).at(-1) || url.hostname;
          node.setMedia({ src, name });
        });
      }}
    />
  );
}

/** Download and Replace from the block menu, for video and audio. */
function useMediaViewActions(
  nodeKey: NodeKey,
  kind: "video" | "audio",
  url: string | null,
  name: string,
) {
  const [editor] = useLexicalComposerContext();
  useBlockViewActions(nodeKey, {
    download: () => {
      if (url) downloadMediaFile(url, name || kind);
    },
    replace: () =>
      chooseFile(`${kind}/*`, (file) => {
        editor.dispatchCommand(UPLOAD_MEDIA_TO_NODE_COMMAND, {
          file,
          kind,
          nodeKey,
          // The upload plugin reports failures itself.
          onComplete: () => undefined,
        });
      }),
  });
}

function useMediaNodeUpdate(nodeKey: NodeKey) {
  const [editor] = useLexicalComposerContext();
  return (change: (node: MediaBlockNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof MediaBlockNode) {
        change(node);
      }
    });
  };
}

function VideoComponent({
  className,
  format,
  nodeKey,
  src,
  name,
  caption,
  width,
  height,
  widthPercent,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  name: string;
  caption: string | undefined;
  nodeKey: NodeKey;
  src: string;
  width: "inherit" | number;
  height: "inherit" | number;
  widthPercent: number | undefined;
}) {
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  const update = useMediaNodeUpdate(nodeKey);
  const failed = isError || isLoadError;
  useMediaViewActions(nodeKey, "video", url, name);
  const aspectRatio =
    widthPercent === undefined && width !== "inherit" && height !== "inherit"
      ? `${width} / ${height}`
      : "auto 16 / 9";
  const updateVideo = (change: (node: VideoNode) => void) =>
    update((node) => {
      if (node instanceof VideoNode) change(node);
    });
  const upload = useNodeUpload(nodeKey);

  if (upload) return <UploadingMedia nodeKey={nodeKey} upload={upload} />;

  return (
    <MediaFrame className={className} format={format} nodeKey={nodeKey}>
      {!src ? (
        <PendingMedia kind="video" nodeKey={nodeKey} />
      ) : (
        <BlockFrame
          nodeKey={nodeKey}
          label={name || t.mediaVideoPlaceholder}
          size={{
            widthPercent,
            legacyWidthPx:
              widthPercent === undefined && width !== "inherit" ? width : undefined,
          }}
          align={alignFromFormat(format)}
          resizable={isEditable && !failed}
          onResize={(next) => updateVideo((node) => node.setWidthPercent(next))}
          onAlign={(next) => update((node) => node.setFormat(next))}
          caption={caption}
          onCaption={(next) => update((node) => node.setCaption(next))}
        >
          {failed ? (
            <MediaFailed label={t.mediaLoadError} />
          ) : !url || isLoading ? (
            <span
              className="flex w-full animate-pulse items-center justify-center rounded-md bg-muted"
              style={{ aspectRatio }}
            >
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </span>
          ) : (
            <video
              controls
              src={url}
              title={name}
              onError={() => setIsLoadError(true)}
              style={{ aspectRatio }}
              className="block h-auto w-full max-w-full rounded-md bg-black"
            />
          )}
        </BlockFrame>
      )}
    </MediaFrame>
  );
}

function AudioComponent({
  className,
  format,
  nodeKey,
  src,
  name,
  caption,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  name: string;
  caption: string | undefined;
  nodeKey: NodeKey;
  src: string;
}) {
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  const update = useMediaNodeUpdate(nodeKey);
  const failed = isError || isLoadError;
  useMediaViewActions(nodeKey, "audio", url, name);
  const upload = useNodeUpload(nodeKey);

  if (upload) return <UploadingMedia nodeKey={nodeKey} upload={upload} />;

  return (
    <MediaFrame className={className} format={format} nodeKey={nodeKey}>
      {!src ? (
        <PendingMedia kind="audio" nodeKey={nodeKey} />
      ) : (
        <BlockFrame
          nodeKey={nodeKey}
          label={name || t.mediaAudioPlaceholder}
          size={{}}
          align="center"
          toolbar="menu"
          caption={caption}
          onCaption={(next) => update((node) => node.setCaption(next))}
        >
          {failed ? (
            <MediaFailed label={t.mediaLoadError} />
          ) : !url || isLoading ? (
            <span className="flex h-12 w-full animate-pulse items-center rounded-md bg-muted px-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </span>
          ) : (
            <AudioCard url={url} name={name} onError={() => setIsLoadError(true)} />
          )}
        </BlockFrame>
      )}
    </MediaFrame>
  );
}

function FileComponent({
  className,
  format,
  nodeKey,
  src,
  name,
  caption,
}: {
  className: Readonly<{ base: string; focus: string }>;
  format: ElementFormatType | null;
  name: string;
  caption: string | undefined;
  nodeKey: NodeKey;
  src: string;
}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const update = useMediaNodeUpdate(nodeKey);

  useBlockViewActions(nodeKey, {
    download: () => {
      if (url) downloadMediaFile(url, name || "file");
    },
    replace: () =>
      chooseFile(undefined, (file) => {
        editor.dispatchCommand(REPLACE_FILE_COMMAND, { nodeKey, file });
      }),
    rename: () => {
      if (!url || isError) return;
      setDraftName(name);
      setRenaming(true);
    },
  });

  useEffect(() => {
    setDraftName(name);
  }, [name]);
  const upload = useNodeUpload(nodeKey);

  const commitName = () => {
    const next = draftName.trim();
    setRenaming(false);
    if (!next || next === name) {
      setDraftName(name);
      return;
    }
    update((node) => node.setName(next));
  };

  if (upload) return <UploadingMedia nodeKey={nodeKey} upload={upload} />;

  if (!src) {
    return (
      <MediaFrame className={className} format={format} nodeKey={nodeKey}>
        <PendingMedia kind="file" nodeKey={nodeKey} />
      </MediaFrame>
    );
  }

  let body: ReactNode;
  if (isError) {
    body = <MediaFailed label={t.mediaLoadError} />;
  } else if (!url || isLoading) {
    body = (
      <span className="flex h-12 w-full animate-pulse items-center gap-3 rounded-md bg-muted px-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </span>
    );
  } else {
    const renameField = (
        <input
          autoFocus
          value={draftName}
          aria-label={t.renameFile}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          onBlur={commitName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitName();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftName(name);
              setRenaming(false);
            }
          }}
        />
    );
    body = (
      <FileCard name={name} nameSlot={renaming ? renameField : undefined} />
    );
  }

  return (
    <MediaFrame className={className} format={format} nodeKey={nodeKey}>
      <BlockFrame
        nodeKey={nodeKey}
        label={name || t.mediaFilePlaceholder}
        size={{}}
        align="center"
        toolbar="menu"
        caption={caption}
        onCaption={(next) => update((node) => node.setCaption(next))}
      >
        {body}
      </BlockFrame>
    </MediaFrame>
  );
}

function embedClassName(config: EditorConfig) {
  const embedBlockTheme = config.theme.embedBlock || {};
  // The block frame draws the selection outline around the block itself.
  return { base: embedBlockTheme.base || "", focus: "" };
}

class MediaBlockNode extends DecoratorBlockNode {
  __src: string;
  __name: string;
  __caption: string | undefined;
  __attachmentId: string | undefined;
  __mimeType: string | undefined;

  constructor(
    src: string,
    name: string,
    attachmentId?: string,
    mimeType?: string,
    format?: ElementFormatType,
    key?: NodeKey,
    caption?: string,
  ) {
    super(format, key);
    this.__src = src;
    this.__name = name;
    this.__caption = caption;
    this.__attachmentId = attachmentId;
    this.__mimeType = mimeType;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getName(): string {
    return this.getLatest().__name;
  }

  getTextContent(): string {
    return this.getName();
  }

  setName(name: string): this {
    const writable = this.getWritable();
    writable.__name = name;
    return writable;
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption ?? undefined;
    return writable;
  }

  setMedia(payload: MediaPayload): this {
    const writable = this.getWritable();
    writable.__src = payload.src;
    writable.__name = payload.name;
    writable.__attachmentId = payload.attachmentId;
    writable.__mimeType = payload.mimeType;
    return writable;
  }

  mediaJSON(): MediaPayload {
    return {
      src: this.getSrc(),
      name: this.getName(),
      attachmentId: this.getLatest().__attachmentId,
      caption: this.getLatest().__caption,
      mimeType: this.getLatest().__mimeType,
    };
  }
}

export class VideoNode extends MediaBlockNode {
  __width: "inherit" | number;
  __height: "inherit" | number;
  __widthPercent: number | undefined;

  constructor(
    src: string,
    name: string,
    attachmentId?: string,
    mimeType?: string,
    format?: ElementFormatType,
    key?: NodeKey,
    width: "inherit" | number = "inherit",
    height: "inherit" | number = "inherit",
    caption?: string,
    widthPercent?: number,
  ) {
    super(src, name, attachmentId, mimeType, format, key, caption);
    this.__width = width;
    this.__height = height;
    this.__widthPercent = widthPercent;
  }

  $config() {
    return this.config("video", {
      extends: DecoratorBlockNode,
      importDOM: {
        video: () => ({ conversion: $convertVideoElement, priority: 0 }),
      },
    });
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(
      node.__src,
      node.__name,
      node.__attachmentId,
      node.__mimeType,
      node.__format,
      node.__key,
      node.__width,
      node.__height,
      node.__caption,
      node.__widthPercent,
    );
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    const node = $createVideoNode(serializedNode).setFormat(serializedNode.format);
    const widthPercent = parseWidthPercent(serializedNode.widthPercent);
    return widthPercent !== undefined
      ? node.setWidthPercent(widthPercent)
      : node.setWidthAndHeight(
          serializedNode.width ?? "inherit",
          serializedNode.height ?? "inherit",
        );
  }

  /** A width in percent, or undefined for Fit. Replaces any pixel size. */
  setWidthPercent(widthPercent: number | undefined): this {
    const writable = this.getWritable();
    writable.__widthPercent = widthPercent;
    writable.__width = "inherit";
    writable.__height = "inherit";
    return writable;
  }

  setWidthAndHeight(
    width: "inherit" | number,
    height: "inherit" | number,
  ): this {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
    return writable;
  }

  exportJSON(): SerializedVideoNode {
    return {
      ...super.exportJSON(),
      ...this.mediaJSON(),
      width: this.__width === "inherit" ? undefined : this.__width,
      height: this.__height === "inherit" ? undefined : this.__height,
      widthPercent: this.__widthPercent,
    };
  }

  exportDOM(): DOMExportOutput {
    if (!this.__src) return { element: null };
    const element = $getDocument().createElement("video");
    element.setAttribute("data-lexical-video", this.__src);
    element.setAttribute("controls", "true");
    writeMediaAttributes(element, this, "src");
    const align = alignFromFormat(this.__format);
    if (this.__widthPercent !== undefined) {
      element.setAttribute("data-width-percent", String(this.__widthPercent));
    } else {
      if (this.__width !== "inherit") {
        element.setAttribute("width", String(this.__width));
      }
      if (this.__height !== "inherit") {
        element.setAttribute("height", String(this.__height));
      }
    }
    const size = {
      widthPercent: this.__widthPercent,
      legacyWidthPx: this.__width === "inherit" ? undefined : this.__width,
    };
    element.setAttribute("data-align", align);
    element.setAttribute("style", exportBlockStyle(size, align));
    return { element };
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <VideoComponent
        className={embedClassName(config)}
        format={this.__format}
        nodeKey={this.getKey()}
        src={this.__src}
        name={this.__name}
        caption={this.__caption}
        width={this.__width}
        height={this.__height}
        widthPercent={this.__widthPercent}
      />
    );
  }
}

export class AudioNode extends MediaBlockNode {
  $config() {
    return this.config("audio", {
      extends: DecoratorBlockNode,
      importDOM: {
        audio: () => ({ conversion: $convertAudioElement, priority: 0 }),
      },
    });
  }

  static clone(node: AudioNode): AudioNode {
    return new AudioNode(
      node.__src,
      node.__name,
      node.__attachmentId,
      node.__mimeType,
      node.__format,
      node.__key,
      node.__caption,
    );
  }

  static importJSON(serializedNode: SerializedMediaNode): AudioNode {
    return $createAudioNode(serializedNode).setFormat(serializedNode.format);
  }

  exportJSON(): SerializedMediaNode {
    return { ...super.exportJSON(), ...this.mediaJSON() };
  }

  exportDOM(): DOMExportOutput {
    if (!this.__src) return { element: null };
    const element = $getDocument().createElement("audio");
    element.setAttribute("data-lexical-audio", this.__src);
    element.setAttribute("controls", "true");
    writeMediaAttributes(element, this, "src");
    return { element };
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <AudioComponent
        className={embedClassName(config)}
        format={this.__format}
        nodeKey={this.getKey()}
        src={this.__src}
        name={this.__name}
        caption={this.__caption}
      />
    );
  }
}

export class FileNode extends MediaBlockNode {
  $config() {
    return this.config("file", {
      extends: DecoratorBlockNode,
      importDOM: {
        a: () => ({ conversion: $convertFileElement, priority: 1 }),
      },
    });
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(
      node.__src,
      node.__name,
      node.__attachmentId,
      node.__mimeType,
      node.__format,
      node.__key,
      node.__caption,
    );
  }

  static importJSON(serializedNode: SerializedMediaNode): FileNode {
    return $createFileNode(serializedNode).setFormat(serializedNode.format);
  }

  exportJSON(): SerializedMediaNode {
    return { ...super.exportJSON(), ...this.mediaJSON() };
  }

  exportDOM(): DOMExportOutput {
    if (!this.__src) return { element: null };
    const element = $getDocument().createElement("a");
    element.setAttribute("data-lexical-file", this.__src);
    element.textContent = this.__name;
    writeMediaAttributes(element, this, "href");
    return { element };
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <FileComponent
        className={embedClassName(config)}
        format={this.__format}
        nodeKey={this.getKey()}
        src={this.__src}
        name={this.__name}
        caption={this.__caption}
      />
    );
  }
}

function $createMedia<T extends MediaBlockNode>(
  Node: new (
    src: string,
    name: string,
    attachmentId?: string,
    mimeType?: string,
    format?: ElementFormatType,
    key?: NodeKey,
  ) => T,
  payload: MediaPayload,
): T {
  const node = new Node(
    payload.src,
    payload.name,
    payload.attachmentId,
    payload.mimeType,
  );
  node.__caption = payload.caption;
  return $applyNodeReplacement(node);
}

export function $createVideoNode(payload: MediaPayload): VideoNode {
  return $createMedia(VideoNode, payload);
}

export function $createAudioNode(payload: MediaPayload): AudioNode {
  return $createMedia(AudioNode, payload);
}

export function $createFileNode(payload: MediaPayload): FileNode {
  return $createMedia(FileNode, payload);
}

export function $isVideoNode(
  node: LexicalNode | null | undefined,
): node is VideoNode {
  return node instanceof VideoNode;
}

export function $isAudioNode(
  node: LexicalNode | null | undefined,
): node is AudioNode {
  return node instanceof AudioNode;
}

export function $isFileNode(
  node: LexicalNode | null | undefined,
): node is FileNode {
  return node instanceof FileNode;
}
