"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { $generateNodesFromDOM } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import { $insertNodes, COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";

import { useEditorAdapters, useNotify } from "../../adapters/context";
import {
  INSERT_AUDIO_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_VIDEO_COMMAND,
} from "../extensions/media";
import type { ImageUploadScope } from "../lib/types";
import { INSERT_IMAGE_COMMAND } from "../nodes/image-node";
import {
  FILE_FIELD_NAMES,
  fileFromImageDataUrl,
  uploadEditorImage,
  uploadErrorMessage,
} from "../utils/images";
import { mediaKindFromFile, uploadEditorMedia } from "../utils/media";

import {
  attachmentFromElement,
  type CommentAttachment,
} from "./attachment-content";

type AttachmentUpload = (files: File[]) => Promise<boolean>;

export const COMMENT_ATTACHMENT_LIMIT_MESSAGE =
  "Only one attachment is allowed per comment. Remove it before adding another.";

/** The file being uploaded: shown from the local copy until it is stored. */
export type PendingAttachment = {
  attachment: CommentAttachment;
  /** 0–1. */
  progress: number;
};

const AttachmentUploadContext = createContext<{
  attachment: CommentAttachment | null;
  pending: PendingAttachment | null;
  uploading: boolean;
  upload: AttachmentUpload;
  /** Stops the upload in progress. */
  cancelUpload: () => void;
  remove: () => void;
  reset: () => void;
} | null>(null);

export function useCommentAttachmentUpload() {
  const context = useContext(AttachmentUploadContext);
  if (!context) {
    throw new Error("Comment attachment upload must be used inside its plugin.");
  }
  return context;
}

export function CommentAttachmentUploadPlugin({
  scope,
  initialAttachment = null,
  children,
}: {
  scope?: ImageUploadScope;
  initialAttachment?: CommentAttachment | null;
  children: ReactNode;
}) {
  const [editor] = useLexicalComposerContext();
  const { files } = useEditorAdapters();
  const toast = useNotify();
  const scopeRef = useRef(scope);
  const filesRef = useRef(files);
  const attachmentRef = useRef<CommentAttachment | null>(initialAttachment);
  const pendingRef = useRef(false);
  const [attachment, setAttachment] = useState<CommentAttachment | null>(
    initialAttachment,
  );
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const uploadRef = useRef<{ controller: AbortController; previewUrl: string } | null>(null);
  const uploading = pending !== null;

  useEffect(() => {
    scopeRef.current = scope;
    filesRef.current = files;
  }, [files, scope]);

  const cancelUpload = useCallback(() => {
    const current = uploadRef.current;
    if (!current) return;
    uploadRef.current = null;
    pendingRef.current = false;
    current.controller.abort();
    URL.revokeObjectURL(current.previewUrl);
    setPending(null);
  }, []);

  // Closing the composer stops its upload.
  useEffect(() => cancelUpload, [cancelUpload]);

  const setCurrentAttachment = useCallback((next: CommentAttachment | null) => {
    attachmentRef.current = next;
    setAttachment(next);
  }, []);

  const remove = useCallback(() => {
    if (pendingRef.current) {
      cancelUpload();
      return;
    }
    setCurrentAttachment(null);
  }, [cancelUpload, setCurrentAttachment]);

  const reset = useCallback(() => {
    cancelUpload();
    const current = attachmentRef.current;
    if (
      current?.src.startsWith("blob:") &&
      current.src !== initialAttachment?.src
    ) {
      URL.revokeObjectURL(current.src);
    }
    setCurrentAttachment(initialAttachment);
  }, [cancelUpload, initialAttachment, setCurrentAttachment]);

  const upload = useCallback<AttachmentUpload>(
    async (files) => {
      if (files.length === 0) return false;
      if (pendingRef.current) {
        toast.message("Wait for the current attachment to finish uploading.");
        return false;
      }
      if (files.length !== 1 || attachmentRef.current) {
        toast.message(COMMENT_ATTACHMENT_LIMIT_MESSAGE);
        return false;
      }

      const file = files[0]!;
      const kind = mediaKindFromFile(file);
      const uploadScope = scopeRef.current
        ? { ...scopeRef.current, fieldName: FILE_FIELD_NAMES.commentImage }
        : undefined;
      const controller = new AbortController();
      const previewUrl = URL.createObjectURL(file);
      const job = { controller, previewUrl };
      uploadRef.current = job;
      pendingRef.current = true;
      setPending({
        attachment: { kind, src: previewUrl, name: file.name, mimeType: file.type, size: file.size },
        progress: 0,
      });
      const options = {
        signal: controller.signal,
        onProgress: (progress: number) => {
          if (uploadRef.current === job) {
            setPending((current) => (current ? { ...current, progress } : current));
          }
        },
      };
      // A cancelled upload leaves no trace, whatever its request does after.
      const stillWanted = () => uploadRef.current === job;

      try {
        if (kind === "image") {
          const image = await uploadEditorImage(file, uploadScope, filesRef.current, options);
          if (!stillWanted()) return false;
          setCurrentAttachment({
            kind,
            src: image.src,
            name: image.altText || file.name,
            attachmentId: image.attachmentId,
            mimeType: file.type,
            size: file.size,
          });
        } else {
          const media = await uploadEditorMedia(file, kind, uploadScope, filesRef.current, options);
          if (!stillWanted()) return false;
          setCurrentAttachment({
            kind,
            src: media.src,
            name: media.name,
            attachmentId: media.attachmentId,
            mimeType: media.mimeType,
            size: file.size,
          });
        }
        return true;
      } catch (caught) {
        if (stillWanted()) toast.error(uploadErrorMessage(caught));
        return false;
      } finally {
        if (stillWanted()) {
          uploadRef.current = null;
          pendingRef.current = false;
          URL.revokeObjectURL(previewUrl);
          setPending(null);
        }
      }
    },
    [setCurrentAttachment, toast],
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          INSERT_IMAGE_COMMAND,
          (payload) => {
            if (pendingRef.current || attachmentRef.current) {
              toast.message(COMMENT_ATTACHMENT_LIMIT_MESSAGE);
              return true;
            }
            setCurrentAttachment({
              kind: "image",
              src: payload.src,
              name: payload.altText || "Image",
              attachmentId: payload.attachmentId,
            });
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        ...([
          [INSERT_VIDEO_COMMAND, "video"],
          [INSERT_AUDIO_COMMAND, "audio"],
          [INSERT_FILE_COMMAND, "file"],
        ] as const).map(([command, kind]) =>
          editor.registerCommand(
            command,
            (payload) => {
              if (pendingRef.current || attachmentRef.current) {
                toast.message(COMMENT_ATTACHMENT_LIMIT_MESSAGE);
                return true;
              }
              setCurrentAttachment({ kind, ...payload });
              return true;
            },
            COMMAND_PRIORITY_HIGH,
          ),
        ),
        editor.registerCommand(
          DRAG_DROP_PASTE,
          (files) => {
            if (files.length === 0) return false;
            void upload(files);
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (!(event instanceof ClipboardEvent)) return false;
            if (event.clipboardData?.files.length) {
              event.preventDefault();
              void upload(Array.from(event.clipboardData.files));
              return true;
            }
            const dataImage = fileFromImageDataUrl(
              event.clipboardData?.getData("text/plain") ?? "",
            );
            if (dataImage) {
              event.preventDefault();
              void upload([dataImage]);
              return true;
            }

            const html = event.clipboardData?.getData("text/html");
            if (!html) return false;
            const pasted = new DOMParser().parseFromString(html, "text/html");
            const elements = pasted.body.querySelectorAll(
              "img, video, audio, a[data-lexical-file]",
            );
            if (elements.length === 0) return false;

            event.preventDefault();
            if (elements.length > 1 || pendingRef.current || attachmentRef.current) {
              toast.message(COMMENT_ATTACHMENT_LIMIT_MESSAGE);
              return true;
            }
            const found = attachmentFromElement(elements[0]!);
            if (!found) {
              toast.error("Could not attach that media.");
              return true;
            }
            // An embedded (base64) image is uploaded like a pasted file,
            // instead of storing its data in the comment.
            const embedded = fileFromImageDataUrl(found.src);
            if (embedded) {
              void upload([embedded]);
            } else {
              setCurrentAttachment(found);
            }
            elements[0]!.remove();
            const nodes = $generateNodesFromDOM(editor, pasted);
            if (nodes.length) $insertNodes(nodes);
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      ),
    [editor, setCurrentAttachment, toast, upload],
  );

  return (
    <AttachmentUploadContext.Provider
      value={{ attachment, pending, uploading, upload, cancelUpload, remove, reset }}
    >
      {children}
    </AttachmentUploadContext.Provider>
  );
}
