"use client";

import { useMemo } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { $getRoot, $parseSerializedNode } from "lexical";
import type * as Y from "yjs";

import { EDITOR_QUERY_KEY, useEditorAdapters, useNotify } from "../../adapters/context";
import type {
  DocumentIdentity,
  EditorVersionSummary,
  NewVersion,
} from "../../adapters/types";

import type { PreviewVersion } from "../components/versions-sidebar";
import type { DocumentSource } from "../lib/types";

import { createHeadlessDocumentEditor } from "./headless";
import { encodeDocState, readDocState, readHtmlState } from "./yjs-binding";

const VERSION_LIST_LIMIT = 50;

/** The versions list; invalidate it after saving one. */
export function versionsQueryKey(identity: DocumentIdentity) {
  return [
    EDITOR_QUERY_KEY,
    "versions",
    identity.entityType,
    identity.entityId,
    identity.documentKey ?? "main",
  ] as const;
}

function toPreviewVersion(version: EditorVersionSummary): PreviewVersion {
  return {
    id: version.id,
    name: version.name || (version.auto ? "Autosave" : `Version #${version.number}`),
    createdAt: Date.parse(version.createdAt),
    auto: version.auto,
    // Loaded when the version is opened (the list does not carry content).
    html: null,
    author: version.author?.name || undefined,
    authorId: version.author?.id,
  };
}

/**
 * A saved document's versions (the app's `versions` adapter): the list, named
 * saves, renames and restore. Restoring writes the version's content as a
 * normal edit, so it is saved and reaches everyone in the live room, then
 * records "Restored from …".
 */
export function useDocumentVersions(source: DocumentSource | undefined, doc: Y.Doc | null) {
  const [editor] = useLexicalComposerContext();
  const queryClient = useQueryClient();
  const { versions: api } = useEditorAdapters();
  const toast = useNotify();
  const identity = useMemo<DocumentIdentity>(
    () => ({
      entityType: source?.entityType ?? "",
      entityId: source?.entityId ?? "",
      documentKey: source?.documentKey ?? "main",
    }),
    [source?.documentKey, source?.entityId, source?.entityType],
  );
  const listKey = versionsQueryKey(identity);
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => api!.list(identity, { limit: VERSION_LIST_LIMIT }),
    enabled: Boolean(api && source?.entityId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });
  const create = useMutation({
    mutationFn: (version: NewVersion) => api!.create(identity, version),
    onSuccess: () => {
      void invalidate();
      toast.success("Version saved");
    },
    onError: () => toast.error("Failed to save version"),
  });
  const update = useMutation({
    mutationFn: ({ versionId, name }: { versionId: string; name: string }) =>
      api!.rename(identity, versionId, name),
    onSuccess: () => {
      void invalidate();
      toast.success("Version renamed");
    },
    onError: () => toast.error("Failed to rename version"),
  });

  const versions = useMemo(() => (list.data ?? []).map(toPreviewVersion), [list.data]);

  const current = () =>
    editor.getEditorState().read(() => ({
      html: $generateHtmlFromNodes(editor, null),
      text: $getRoot().getTextContent(),
    }));

  const versionBody = (state: Y.Doc, name: string): NewVersion => {
    const { html, text } = current();
    return {
      state: encodeDocState(state),
      html,
      text: text.slice(0, 500),
      name,
      auto: false,
    };
  };

  const saveNamed = (name: string) => {
    if (doc && api) create.mutate(versionBody(doc, name));
  };

  const rename = (id: string, name: string) => {
    if (api) update.mutate({ versionId: id, name });
  };

  const restore = (version: PreviewVersion) => {
    if (!source || !doc || !api) return;
    const run = async () => {
      const full = await api.get(identity, version.id);
      // A Lexical snapshot when there is one; otherwise the version's HTML
      // (versions converted from the old editor keep only that).
      const state =
        full.stateFormat === "lexical" && full.snapshotState
          ? await readDocState(full.snapshotState, createHeadlessDocumentEditor)
          : full.html?.trim()
            ? readHtmlState(full.html, createHeadlessDocumentEditor)
            : null;
      if (!state) {
        throw new Error("This version has nothing to restore.");
      }
      // The current content stays available as a version, as the dialog promises.
      await api.create(identity, versionBody(doc, `Before restoring ${version.name}`));
      await new Promise<void>((resolve) => {
        editor.update(
          () => {
            const root = $getRoot();
            root.clear();
            root.append(...state.root.children.map((child) => $parseSerializedNode(child)));
          },
          { onUpdate: resolve },
        );
      });
      await api.create(identity, versionBody(doc, `Restored from ${version.name}`));
      await invalidate();
    };
    toast.promise(run(), {
      loading: "Restoring version…",
      success: "Version restored",
      error: (error: unknown) =>
        error instanceof Error ? error.message : "Couldn't restore this version.",
    });
  };

  return { versions, save: saveNamed, rename, restore, loading: list.isPending };
}
