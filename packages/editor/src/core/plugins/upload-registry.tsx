"use client";

import { type ReactNode, useEffect, useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  COLLABORATION_TAG,
  type Klass,
  type LexicalNode,
} from "lexical";

import { UploadRegistryContext, uploadRegistryFor } from "../lib/upload-registry";
import { ImageNode } from "../nodes/image-node";
import { AudioNode, FileNode, VideoNode } from "../nodes/media-node";

const MEDIA_NODES: Klass<LexicalNode>[] = [ImageNode, VideoNode, AudioNode, FileNode];

function hasSource(node: LexicalNode | null): boolean {
  return (
    node instanceof ImageNode ||
    node instanceof VideoNode ||
    node instanceof AudioNode ||
    node instanceof FileNode
  ) && Boolean(node.getSrc());
}

/**
 * Holds the editor's uploads. It also forgets an upload whose node goes away
 * (deleted, or removed by a collaborator), warns before leaving the page
 * mid-upload, and notes empty media blocks inserted here, so only those open
 * their picker (not a block a collaborator added, or one saved empty).
 */
export function UploadRegistryProvider({ children }: { children: ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const [registry] = useState(() => uploadRegistryFor(editor));

  useEffect(() => {
    const unregister = mergeRegister(
      ...MEDIA_NODES.filter((klass) => editor.hasNode(klass)).map((klass) =>
        editor.registerMutationListener(
          klass,
          (mutations, { updateTags }) => {
            for (const [nodeKey, mutation] of mutations) {
              if (mutation === "destroyed") {
                registry.clear(nodeKey);
                registry.unmarkFresh(nodeKey);
              } else if (
                mutation === "created" &&
                !updateTags.has(COLLABORATION_TAG) &&
                !registry.get(nodeKey) &&
                !editor.getEditorState().read(() => hasSource($getNodeByKey(nodeKey)))
              ) {
                registry.markFresh(nodeKey);
              }
            }
          },
          { skipInitialization: true },
        ),
      ),
    );
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!registry.hasPending()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [editor, registry]);

  useEffect(() => () => registry.dispose(), [registry]);

  return (
    <UploadRegistryContext.Provider value={registry}>{children}</UploadRegistryContext.Provider>
  );
}
