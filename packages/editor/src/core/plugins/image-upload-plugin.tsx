"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { $insertDataTransferForRichText } from "@lexical/clipboard";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  HISTORY_MERGE_TAG,
  PASTE_COMMAND,
  type NodeKey,
} from "lexical";
import { EDITOR_QUERY_KEY, useEditorAdapters, useNotify } from "../../adapters/context";

import {
  $insertImageNode,
  $selectAfterImage,
  registerInsertImageCommand,
} from "../extensions/image";
import { uploadEmbeddedImages } from "../lib/transfer";
import type { ImageUploadScope } from "../lib/types";
import { type UploadRun, useUploadRegistry } from "../lib/upload-registry";
import {
  $isImageNode,
  UPLOAD_IMAGE_TO_NODE_COMMAND,
} from "../nodes/image-node";
import {
  fileFromImageDataUrl,
  isAcceptedImage,
  uploadEditorImage,
} from "../utils/images";

const EMBEDDED_IMAGE = /data:image\/(?:png|jpe?g|gif|webp);base64,/i;

type UploadImages = (files: File[], nodeKey?: NodeKey) => Promise<boolean>;

type ImageUploadContextValue = {
  upload: UploadImages;
  uploading: boolean;
};

const ImageUploadContext = createContext<ImageUploadContextValue | null>(null);

function useImageUploadContext(): ImageUploadContextValue {
  const context = useContext(ImageUploadContext);
  if (!context) {
    throw new Error("useImageUpload must be used inside ImageUploadPlugin.");
  }
  return context;
}

export function useImageUpload(): UploadImages {
  return useImageUploadContext().upload;
}

export function useImageUploading(): boolean {
  return useImageUploadContext().uploading;
}

/**
 * Uploads through the app's `files` adapter when a scope is set, then inserts the image.
 * Also takes image files pasted or dropped into the editor, a pasted
 * `data:image/...;base64` URL, and pasted rich content with embedded (base64)
 * images, which are uploaded before the content goes in.
 */
export function ImageUploadPlugin({
  scope,
  children,
}: {
  scope?: ImageUploadScope;
  children: ReactNode;
}) {
  const [editor] = useLexicalComposerContext();
  const { files } = useEditorAdapters();
  const toast = useNotify();
  const scopeRef = useRef(scope);
  const filesRef = useRef(files);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    scopeRef.current = scope;
    filesRef.current = files;
  }, [files, scope]);

  const registry = useUploadRegistry();
  const queryClient = useQueryClient();

  /**
   * Shows the image right away (faded, with progress) and uploads it: into a
   * new image at the caret, or into `nodeKey` (an empty image block, or one
   * being replaced). Failures stay on the image with Retry.
   */
  const startUpload = useCallback(
    (file: File, nodeKey?: NodeKey) => {
      const begin = (target: NodeKey, replacing: boolean) => {
        const run: UploadRun = async (signal, onProgress) => {
          const uploaded = await uploadEditorImage(file, scopeRef.current, filesRef.current, {
            signal,
            onProgress,
          });
          // The stored image shows without another lookup.
          if (uploaded.url) {
            queryClient.setQueryData([EDITOR_QUERY_KEY, "inline-file", uploaded.src], uploaded.url);
          }
          let applied = false;
          editor.update(
            () => {
              const node = $getNodeByKey(target);
              if ($isImageNode(node)) {
                node.setImage(uploaded);
                applied = true;
              }
            },
            { tag: HISTORY_MERGE_TAG, discrete: true },
          );
          return applied ? "finishing" : "done";
        };
        if (registry) {
          registry.start(target, file, "image", run, { replacing });
          return;
        }
        void run(new AbortController().signal, () => undefined).catch((caught) => {
          toast.error(caught instanceof Error ? caught.message : "Image upload failed.");
        });
      };
      // Inside a command (paste, drop, an image block's picker) this update
      // runs after the handler, so the upload starts from within it.
      editor.update(() => {
        const existing = nodeKey ? $getNodeByKey(nodeKey) : null;
        if ($isImageNode(existing)) {
          const replacing = Boolean(existing.getSrc());
          if (!replacing) $selectAfterImage(existing);
          begin(existing.getKey(), replacing);
          return;
        }
        if (!$getSelection()) $getRoot().selectEnd();
        begin($insertImageNode({ src: "", altText: file.name }).getKey(), false);
      });
    },
    [editor, queryClient, registry, toast],
  );

  const upload = useCallback<UploadImages>(
    async (files, nodeKey) => {
      const accepted = files.filter(isAcceptedImage);
      if (accepted.length === 0) {
        if (files.length > 0) {
          toast.error("Use a PNG, JPEG, GIF, or WebP image.");
        }
        return false;
      }
      // An empty block takes the first file; any others go in below it.
      accepted.forEach((file, index) => startUpload(file, index === 0 ? nodeKey : undefined));
      return true;
    },
    [startUpload, toast],
  );

  const pasteWithUploadedImages = useCallback(
    async (html: string, plain: string) => {
      setUploading(true);
      try {
        const uploaded = await uploadEmbeddedImages(html, async (file) => {
          const image = await uploadEditorImage(file, scopeRef.current, filesRef.current);
          return image.src;
        });
        editor.update(() => {
          if (!$getSelection()) $getRoot().selectEnd();
          const selection = $getSelection();
          if (!selection) return;
          const data = new DataTransfer();
          data.setData("text/html", uploaded);
          data.setData("text/plain", plain);
          $insertDataTransferForRichText(data, selection, editor);
        });
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "Image upload failed.",
        );
      } finally {
        setUploading(false);
      }
    },
    [editor, toast],
  );

  useEffect(
    () =>
      mergeRegister(
        registerInsertImageCommand(editor),
        editor.registerCommand(
          UPLOAD_IMAGE_TO_NODE_COMMAND,
          ({ file, nodeKey, onComplete }) => {
            void upload([file], nodeKey).then(onComplete, () => onComplete(false));
            return true;
          },
          COMMAND_PRIORITY_EDITOR,
        ),
        editor.registerCommand(
          DRAG_DROP_PASTE,
          (files) => {
            const accepted = files.filter(isAcceptedImage);
            if (accepted.length === 0) {
              return false;
            }
            upload(accepted);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (!(event instanceof ClipboardEvent)) return false;
            const plain = event.clipboardData?.getData("text/plain") ?? "";
            const file = fileFromImageDataUrl(plain);
            if (file) {
              event.preventDefault();
              upload([file]);
              return true;
            }
            // A copy from Google Docs, Word or another page can carry its
            // images as base64. Upload them first, then paste as usual.
            const html = event.clipboardData?.getData("text/html") ?? "";
            if (!EMBEDDED_IMAGE.test(html)) return false;
            event.preventDefault();
            void pasteWithUploadedImages(html, plain);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, pasteWithUploadedImages, upload],
  );

  const value = useMemo(
    () => ({ upload, uploading }),
    [upload, uploading],
  );

  return (
    <ImageUploadContext.Provider value={value}>
      {children}
    </ImageUploadContext.Provider>
  );
}
