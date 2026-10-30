"use client";

import { useQuery } from "@tanstack/react-query";

import { EDITOR_QUERY_KEY, useEditorAdapters } from "../../adapters/context";
import { getUserCollabColor } from "../../lib/utils";

import type { DocumentSource } from "../lib/types";

import type { CollaborationUser, DocumentSeed } from "./collaboration";

export type LoadedDocument = {
  seed: DocumentSeed;
  revision: number | undefined;
};

/**
 * The saved document (the app's `documents.load`) and the current user,
 * before the editor mounts. A document opens from its saved Y.Doc; without
 * one, from its saved HTML (the backend writes HTML when content is set
 * outside the editor), then the page's `initialHtml`; otherwise it starts
 * empty.
 */
export function useDocumentLoad(source: DocumentSource | undefined): {
  loading: boolean;
  document: LoadedDocument | null;
  user: CollaborationUser | null;
  /**
   * Only part of the saved HTML came back and there is no live state to open
   * instead. Opening it would save the partial copy over the real document,
   * so the editor waits for a retry.
   */
  incomplete: boolean;
  /**
   * The saved document couldn't be loaded at all. Opening it empty would let
   * an edit save over the real one, so the editor waits for a retry.
   */
  failed: boolean;
  retry: () => void;
  retrying: boolean;
} {
  const { documents, currentUser } = useEditorAdapters();
  const identity = {
    entityType: source?.entityType ?? "",
    entityId: source?.entityId ?? "",
    documentKey: source?.documentKey,
  };
  const state = useQuery({
    queryKey: [
      EDITOR_QUERY_KEY,
      "document",
      identity.entityType,
      identity.entityId,
      identity.documentKey ?? "main",
    ],
    queryFn: ({ signal }) => documents!.load(identity, { signal }),
    enabled: Boolean(source?.entityId && documents),
    // The editor reads it once; later changes arrive through the live room.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (source && !documents) {
    throw new Error("A document `source` needs the EditorProvider's `documents` adapter.");
  }

  const retry = () => void state.refetch();
  const retrying = state.isFetching;
  const none = { document: null, user: null, incomplete: false, failed: false, retry, retrying };
  if (!source) return { ...none, loading: false };
  if (state.isPending || !currentUser) return { ...none, loading: true };
  if (state.isError && !state.data) return { ...none, loading: false, failed: true };

  const saved = state.data;
  if (!saved?.yjsState && saved?.incomplete) {
    return { ...none, loading: false, incomplete: true };
  }
  let seed: DocumentSeed = { kind: "empty" };
  if (saved?.yjsState) {
    seed = { kind: "yjs", state: saved.yjsState };
  } else if (saved?.html?.trim()) {
    seed = { kind: "html", html: saved.html };
  } else if (source.initialHtml?.trim()) {
    seed = { kind: "html", html: source.initialHtml };
  }

  const user: CollaborationUser = {
    id: currentUser.id,
    name: currentUser.name.trim() || "Someone",
    color: currentUser.color ?? getUserCollabColor(currentUser.id),
    avatarUrl: currentUser.avatarUrl ?? undefined,
  };

  return {
    loading: false,
    document: { seed, revision: saved?.revision ?? undefined },
    user,
    incomplete: false,
    failed: false,
    retry,
    retrying,
  };
}
