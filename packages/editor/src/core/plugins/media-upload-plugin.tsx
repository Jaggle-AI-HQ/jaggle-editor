"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  HISTORY_MERGE_TAG,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { EDITOR_QUERY_KEY, useEditorAdapters, useNotify } from "../../adapters/context";

import { $insertMediaNode } from "../extensions/media";
import type { ImageUploadScope } from "../lib/types";
import { type UploadRun, useUploadRegistry } from "../lib/upload-registry";
import {
  $isAudioNode,
  $isFileNode,
  $isVideoNode,
  type AudioNode,
  type FileNode,
  REPLACE_FILE_COMMAND,
  UPLOAD_MEDIA_TO_NODE_COMMAND,
  type VideoNode,
} from "../nodes/media-node";
import {
  mediaKindFromFile,
  type UploadedMedia,
  uploadEditorMedia,
} from "../utils/media";

type MediaKind = UploadedMedia["kind"];

function $isMediaBlock(
  node: LexicalNode | null,
): node is VideoNode | AudioNode | FileNode {
  return $isVideoNode(node) || $isAudioNode(node) || $isFileNode(node);
}

/** Caret into the paragraph after a block (added when missing). */
function $selectAfterBlock(node: LexicalNode) {
  const next = node.getNextSibling();
  if ($isParagraphNode(next)) {
    next.selectStart();
    return;
  }
  const paragraph = $createParagraphNode();
  node.insertAfter(paragraph);
  paragraph.select();
}

export function MediaUploadPlugin({
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
  const registry = useUploadRegistry();
  const queryClient = useQueryClient();

  useEffect(() => {
    scopeRef.current = scope;
    filesRef.current = files;
  }, [files, scope]);

  /**
   * Shows the block right away (faded, with progress) and uploads into it: a
   * new block below the caret, or `nodeKey` (an empty block, or one being
   * replaced). Failures stay on the block with Retry.
   */
  const startUpload = useCallback(
    (file: File, kind: MediaKind, nodeKey?: NodeKey) => {
      const begin = (target: NodeKey, replacing: boolean) => {
        const run: UploadRun = async (signal, onProgress) => {
          const uploaded = await uploadEditorMedia(file, kind, scopeRef.current, filesRef.current, {
            signal,
            onProgress,
          });
          if (uploaded.url) {
            queryClient.setQueryData([EDITOR_QUERY_KEY, "inline-file", uploaded.src], uploaded.url);
          }
          editor.update(
            () => {
              const node = $getNodeByKey(target);
              if ($isMediaBlock(node)) {
                node.setMedia({
                  src: uploaded.src,
                  name: uploaded.name,
                  attachmentId: uploaded.attachmentId,
                  mimeType: uploaded.mimeType,
                });
              }
            },
            { tag: HISTORY_MERGE_TAG, discrete: true },
          );
          return "done";
        };
        if (registry) {
          registry.start(target, file, kind, run, { replacing });
          return;
        }
        void run(new AbortController().signal, () => undefined).catch((caught) => {
          toast.error(caught instanceof Error ? caught.message : "File upload failed.");
        });
      };
      // Inside a command (paste, drop, a block's picker) this update runs
      // after the handler, so the upload starts from within it.
      editor.update(() => {
        const existing = nodeKey ? $getNodeByKey(nodeKey) : null;
        if ($isMediaBlock(existing)) {
          const replacing = Boolean(existing.getSrc());
          if (!replacing) $selectAfterBlock(existing);
          begin(existing.getKey(), replacing);
          return;
        }
        if (!$getSelection()) $getRoot().selectEnd();
        begin(
          $insertMediaNode(kind, {
            src: "",
            name: file.name || "File",
            mimeType: file.type,
          }).getKey(),
          false,
        );
      });
    },
    [editor, queryClient, registry, toast],
  );

  const upload = useCallback(
    async (files: File[], kind?: MediaKind, nodeKey?: NodeKey) => {
      const accepted = files.filter((file) => {
        const nextKind = mediaKindFromFile(file);
        if (kind === "file") {
          return true;
        }
        if (kind) {
          return nextKind === kind;
        }
        return nextKind !== "image";
      });
      if (accepted.length === 0) {
        if (files.length > 0 && kind) {
          toast.error(
            kind === "video"
              ? "Use a video file."
              : kind === "audio"
                ? "Use an audio file."
                : "Choose a file.",
          );
        }
        return false;
      }

      accepted.forEach((file, index) => {
        const detected = mediaKindFromFile(file);
        const nextKind = kind ?? (detected === "image" ? "file" : detected);
        // An empty block takes the first file; any others go in below it.
        startUpload(file, nextKind, index === 0 ? nodeKey : undefined);
      });
      return true;
    },
    [startUpload, toast],
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          UPLOAD_MEDIA_TO_NODE_COMMAND,
          ({ file, kind, nodeKey, onComplete }) => {
            void upload([file], kind, nodeKey).then(
              onComplete,
              () => onComplete(false),
            );
            return true;
          },
          COMMAND_PRIORITY_EDITOR,
        ),
        editor.registerCommand(
          DRAG_DROP_PASTE,
          (files) => {
            const accepted = files.filter(
              (file) => mediaKindFromFile(file) !== "image",
            );
            if (accepted.length === 0) {
              return false;
            }
            upload(accepted);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          REPLACE_FILE_COMMAND,
          ({ nodeKey, file }) => {
            startUpload(file, "file", nodeKey);
            return true;
          },
          COMMAND_PRIORITY_EDITOR,
        ),
      ),
    [editor, startUpload, upload],
  );

  return <>{children}</>;
}
