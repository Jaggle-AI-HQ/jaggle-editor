"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import type * as Y from "yjs";

import { CommentExtension, type Comments, setThreads } from "../extensions/comment";

import {
  type CommentAuthor,
  hydrateThreads,
  observeThreads,
  readThreads,
  type ThreadActions,
  type ThreadSync,
} from "./thread-store";

const ThreadActionsContext = createContext<ThreadActions | null>(null);

export const ThreadActionsProvider = ThreadActionsContext.Provider;

/** Comment actions for the current document (create, reply, edit, react…). */
export function useThreadActions(): ThreadActions {
  const actions = useContext(ThreadActionsContext);
  if (!actions) {
    throw new Error("useThreadActions must be used inside a document editor.");
  }
  return actions;
}

/**
 * Shows the Y.Doc's threads in the comment UI, and once the document is ready
 * adds threads only the app has (`sync`).
 */
export function ThreadStorePlugin({
  doc,
  sync,
  me,
  ready,
}: {
  doc: Y.Doc;
  sync: ThreadSync | null;
  me: CommentAuthor;
  ready: boolean;
}) {
  const state = useExtensionDependency(CommentExtension).output;
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    const sync = () => {
      setThreads(state, readThreads(doc));
    };
    sync();
    return observeThreads(doc, sync);
  }, [doc, state]);

  useEffect(() => {
    if (!ready || !sync?.identity.entityId) return;
    hydrateThreads(doc, sync, meRef.current).catch(() => {
      // Threads in the document still show; the app's are added on the next open.
    });
  }, [doc, ready, sync]);

  return null;
}

/** Re-sends "read now" this often while the comments panel stays open. */
const READ_STATE_INTERVAL_MS = 60_000;

/** Whether the app keeps a per-person read marker for this document's comments. */
export function hasReadState(sync: ThreadSync | null): sync is ThreadSync {
  return Boolean(sync?.api.getReadState && sync.api.saveReadState);
}

/**
 * Whether someone else commented, in an open thread, since the viewer last
 * had the comments open: the app's per-person marker, so it follows them
 * across devices. On a first visit existing comments count as read.
 */
export function useUnreadComments(
  sync: ThreadSync | null,
  comments: Comments,
  meId: string,
  open: boolean,
): boolean {
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);

  useEffect(() => {
    if (!hasReadState(sync) || !sync.identity.entityId) return;
    const { identity, api } = sync;
    let cancelled = false;
    const markRead = () => {
      const now = new Date().toISOString();
      setLastReadAt(Date.parse(now));
      api.saveReadState!(identity, now).catch(() => {
        // The dot is a hint; the next open sends it again.
      });
    };
    if (open) {
      markRead();
      const timer = setInterval(markRead, READ_STATE_INTERVAL_MS);
      return () => {
        clearInterval(timer);
        // Comments seen until the panel closed count as read.
        markRead();
      };
    }
    api.getReadState!(identity)
      .then((value) => {
        if (cancelled) return;
        if (value === null) markRead();
        else setLastReadAt((current) => Math.max(current ?? 0, Date.parse(value)));
      })
      .catch(() => {
        // Without a marker no dot shows.
      });
    return () => {
      cancelled = true;
    };
  }, [open, sync]);

  if (open || lastReadAt === null) return false;
  return comments.some(
    (thread) =>
      !thread.resolved &&
      thread.comments.some(
        (comment) =>
          !comment.deleted && comment.authorId !== meId && comment.timeStamp > lastReadAt,
      ),
  );
}
