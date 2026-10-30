import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { useQuery } from "@tanstack/react-query";
import {
  $applyNodeReplacement,
  $getDocument,
  $getNodeByKey,
  $isElementNode,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DecoratorNode,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  mergeRegister,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { ImageIcon, ImageOffIcon } from "lucide-react";



import { EDITOR_QUERY_KEY, useFileUrlResolver } from "../../adapters/context";
import { AltTextDialog } from "../components/alt-text-dialog";
import { BlockFrame } from "../components/block-frame";
import { downloadMediaFile } from "../components/media-hover-menu";
import { MediaInsertPlaceholder } from "../components/media-insert-placeholder";
import { UploadingMedia } from "../components/upload-state";
import { chooseFile, useBlockViewActions } from "../lib/block-commands";
import {
  alignFromFormat,
  type BlockAlign,
  exportBlockStyle,
  parseWidthPercent,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";
import {
  useFreshPlaceholder,
  useNodeUpload,
  useUploadRegistry,
} from "../lib/upload-registry";

export interface ImagePayload {
  altText: string;
  attachmentId?: string;
  caption?: string;
  height?: number;
  key?: NodeKey;
  maxWidth?: number;
  src: string;
  width?: number;
  /** Width as a percentage of the column; none is Fit. */
  widthPercent?: number;
}

export type InsertImagePayload = Readonly<ImagePayload>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND");

// Decorator views render in a portal, outside ImageUploadPlugin's React context.
export const UPLOAD_IMAGE_TO_NODE_COMMAND: LexicalCommand<{
  file: File;
  nodeKey: NodeKey;
  onComplete: (success: boolean) => void;
}> = createCommand("UPLOAD_IMAGE_TO_NODE_COMMAND");

export type SerializedImageNode = Spread<
  {
    altText: string;
    attachmentId?: string;
    caption?: string;
    height?: number;
    maxWidth: number;
    src: string;
    width?: number;
    widthPercent?: number;
  },
  SerializedLexicalNode
>;

const REFERENCE_PREFIX = "jaggle-file://";

export function $convertImageElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLImageElement)) {
    return null;
  }
  const { alt, width, height } = domNode;
  const src = domNode.getAttribute("src") ?? "";
  if (!src || src.startsWith("file:///")) {
    return null;
  }
  const widthPercent = parseWidthPercent(domNode.dataset.widthPercent);
  return {
    node: $createImageNode({
      altText: alt,
      attachmentId: domNode.dataset.attachmentId || undefined,
      caption: domNode.dataset.caption,
      height: widthPercent === undefined ? height || undefined : undefined,
      src,
      width: widthPercent === undefined ? width || undefined : undefined,
      widthPercent,
    }),
  };
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __attachmentId: string | undefined;
  __caption: string | undefined;
  __width: "inherit" | number;
  __height: "inherit" | number;
  __maxWidth: number;
  __widthPercent: number | undefined;

  $config() {
    return this.config("image", {
      extends: DecoratorNode,
      importDOM: {
        img: () => ({ conversion: $convertImageElement, priority: 0 }),
      },
    });
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__attachmentId,
      node.__key,
      node.__caption,
      node.__widthPercent,
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const {
      altText,
      attachmentId,
      caption,
      height,
      maxWidth,
      src,
      width,
      widthPercent,
    } = serializedNode;
    return $createImageNode({
      altText,
      attachmentId,
      caption,
      height,
      maxWidth,
      src,
      width,
      widthPercent: parseWidthPercent(widthPercent),
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      altText: this.getAltText(),
      attachmentId: this.getLatest().__attachmentId,
      caption: this.getLatest().__caption,
      height: this.__height === "inherit" ? undefined : this.__height,
      maxWidth: this.__maxWidth,
      src: this.getSrc(),
      width: this.__width === "inherit" ? undefined : this.__width,
      widthPercent: this.getLatest().__widthPercent,
    };
  }

  exportDOM(): DOMExportOutput {
    if (!this.__src) return { element: null };
    const element = $getDocument().createElement("img");
    element.setAttribute("src", this.__src);
    element.setAttribute("alt", this.__altText);
    if (this.__attachmentId) {
      element.setAttribute("data-attachment-id", this.__attachmentId);
    }
    if (this.__caption !== undefined) {
      element.setAttribute("data-caption", this.__caption);
    }
    const size = this.getSize();
    const parent = this.getParent();
    const align = alignFromFormat($isElementNode(parent) ? parent.getFormatType() : "");
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
    if (size.widthPercent !== undefined || size.legacyWidthPx !== undefined) {
      element.setAttribute("data-align", align);
      element.setAttribute("style", exportBlockStyle(size, align));
    }
    return { element };
  }

  constructor(
    src: string,
    altText: string,
    maxWidth: number,
    width?: "inherit" | number,
    height?: "inherit" | number,
    attachmentId?: string,
    key?: NodeKey,
    caption?: string,
    widthPercent?: number,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__maxWidth = maxWidth;
    this.__width = width || "inherit";
    this.__height = height || "inherit";
    this.__attachmentId = attachmentId;
    this.__caption = caption;
    this.__widthPercent = widthPercent;
  }

  getSize(): { widthPercent?: number; legacyWidthPx?: number } {
    const latest = this.getLatest();
    return {
      widthPercent: latest.__widthPercent,
      legacyWidthPx: latest.__width === "inherit" ? undefined : latest.__width,
    };
  }

  /** A width in percent, or undefined for Fit. Replaces any pixel size. */
  setWidthPercent(widthPercent: number | undefined): this {
    const writable = this.getWritable();
    writable.__widthPercent = widthPercent;
    writable.__width = "inherit";
    writable.__height = "inherit";
    return writable;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = $getDocument().createElement("span");
    const className = config.theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAltText(): string {
    return this.getLatest().__altText;
  }

  setImage(payload: {
    src: string;
    altText: string;
    attachmentId?: string;
  }): this {
    const writable = this.getWritable();
    writable.__src = payload.src;
    writable.__altText = payload.altText;
    writable.__attachmentId = payload.attachmentId;
    writable.__width = "inherit";
    writable.__height = "inherit";
    // A replaced image keeps its width (a percentage) and placement.
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

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption ?? undefined;
    return writable;
  }

  setAltText(altText: string): this {
    const writable = this.getWritable();
    writable.__altText = altText;
    return writable;
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        caption={this.__caption}
        width={this.__width}
        widthPercent={this.__widthPercent}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createImageNode({
  altText,
  attachmentId,
  caption,
  height,
  maxWidth,
  src,
  width,
  widthPercent,
  key,
}: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(
      src,
      altText,
      maxWidth ?? 0,
      width,
      height,
      attachmentId,
      key,
      caption,
      widthPercent,
    ),
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}

/** The paragraph's alignment, which places the image; follows later changes. */
function useParagraphAlign(editor: LexicalEditor, nodeKey: NodeKey): BlockAlign {
  // Reads the committed state: `editor.read` would flush pending updates
  // (and run other plugins' listeners) in the middle of a render.
  const read = useCallback(
    () =>
      editor.getEditorState().read(() => {
        const parent = $getNodeByKey(nodeKey)?.getParent();
        return alignFromFormat($isElementNode(parent) ? parent.getFormatType() : "");
      }),
    [editor, nodeKey],
  );
  const [align, setAlign] = useState<BlockAlign>(read);
  useEffect(
    () => editor.registerUpdateListener(() => setAlign(read())),
    [editor, read],
  );
  return align;
}

function useImageUrl(src: string) {
  const resolveUrl = useFileUrlResolver();
  const reference = src.startsWith(REFERENCE_PREFIX);
  const resolved = useQuery({
    queryKey: [EDITOR_QUERY_KEY, "inline-file", src],
    queryFn: () => resolveUrl(src),
    enabled: reference,
    staleTime: 60_000,
  });
  if (!reference) {
    return { url: src, isError: false };
  }
  return { url: resolved.data ?? null, isError: resolved.isError };
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

function ImageComponent({
  src,
  altText,
  caption,
  nodeKey,
  width,
  widthPercent,
}: {
  altText: string;
  caption: string | undefined;
  nodeKey: NodeKey;
  src: string;
  width: "inherit" | number;
  widthPercent: number | undefined;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { url, isError: isResolveError } = useImageUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  const align = useParagraphAlign(editor, nodeKey);
  const failed = isLoadError || isResolveError;
  const [editingAltText, setEditingAltText] = useState(false);
  const upload = useNodeUpload(nodeKey);
  const registry = useUploadRegistry();
  const freshPlaceholder = useFreshPlaceholder(nodeKey);

  // Once stored, the local preview stays until the stored image has loaded,
  // so the image doesn't blink out in between.
  const finishing = upload?.status === "finishing";
  useEffect(() => {
    if (!finishing || !url) return;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      registry?.clear(nodeKey);
    };
    const stored = new window.Image();
    stored.onload = finish;
    stored.onerror = finish;
    stored.src = url;
    const timer = setTimeout(finish, 15_000);
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [finishing, url, nodeKey, registry]);

  const onClick = useCallback(
    (event: MouseEvent) => {
      if (event.target === imageRef.current) {
        if (event.shiftKey) {
          setSelected(!isSelected);
        } else {
          clearSelection();
          setSelected(true);
        }
        return true;
      }
      return false;
    },
    [clearSelection, isSelected, setSelected],
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
      ),
    [editor, onClick],
  );

  const update = (change: (node: ImageNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) {
        change(node);
      }
    });
  };

  const uploadTo = (file: File) =>
    new Promise<boolean>((resolve) => {
      if (
        !editor.dispatchCommand(UPLOAD_IMAGE_TO_NODE_COMMAND, {
          file,
          nodeKey,
          onComplete: resolve,
        })
      ) {
        resolve(false);
      }
    });

  useBlockViewActions(nodeKey, {
    download: () => {
      if (url) downloadMediaFile(url, altText || "image");
    },
    replace: () => chooseFile(IMAGE_ACCEPT, (file) => void uploadTo(file)),
    "alt-text": () => setEditingAltText(true),
  });

  if (upload) {
    return <UploadingMedia inline nodeKey={nodeKey} upload={upload} />;
  }

  if (!src && isEditable) {
    return (
      <MediaInsertPlaceholder
        defaultOpen={freshPlaceholder}
        icon={<ImageIcon className="size-5" />}
        label={t.mediaImagePlaceholder}
        accept={IMAGE_ACCEPT}
        onUpload={uploadTo}
        onLink={(nextSrc) => {
          update((node) => {
            const link = new URL(nextSrc);
            node.setImage({
              src: nextSrc,
              altText: link.pathname.split("/").filter(Boolean).at(-1) || "Image",
            });
          });
        }}
      />
    );
  }

  return (
    <BlockFrame
      inline
      nodeKey={nodeKey}
      label={altText || t.mediaImagePlaceholder}
      size={{ widthPercent, legacyWidthPx: width === "inherit" ? undefined : width }}
      align={align}
      resizable={!failed && Boolean(url)}
      onResize={(next) => update((node) => node.setWidthPercent(next))}
      onAlign={(next) =>
        update((node) => {
          const parent = node.getParent();
          if ($isElementNode(parent)) {
            parent.setFormat(next);
          }
          // Re-render this view even when only the paragraph changed.
          node.getWritable();
        })
      }
      caption={caption}
      onCaption={(next) => update((node) => node.setCaption(next))}
    >
      {editingAltText ? (
        <AltTextDialog
          altText={altText}
          onSave={(next) => update((node) => node.setAltText(next))}
          onClose={() => setEditingAltText(false)}
        />
      ) : null}
      {failed || !src ? (
        <span className="flex aspect-video w-full max-w-sm flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted text-muted-foreground">
          <ImageOffIcon className="size-6" />
          <span className="text-xs">{altText || "Image failed to load"}</span>
        </span>
      ) : url ? (
        <img
          ref={imageRef}
          src={url}
          alt={altText}
          draggable={false}
          onError={() => setIsLoadError(true)}
          className="block h-auto w-full max-w-full rounded-md select-none"
        />
      ) : (
        <span className="block aspect-video w-full max-w-sm animate-pulse rounded-md bg-muted" />
      )}
    </BlockFrame>
  );
}
