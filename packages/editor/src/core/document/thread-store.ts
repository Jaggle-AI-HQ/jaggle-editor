import * as Y from "yjs";

import type {
  DocumentIdentity,
  EditorNotify,
  EditorThread,
  EditorThreadComment,
  ThreadsAdapter,
} from "../../adapters/types";

import type { Comment, CommentReaction, Thread } from "../extensions/comment";
import { mentionedUserIds } from "../lib/comment-payload";
import type { CommentBody } from "../lib/types";

/**
 * A document's comment threads. They live in a Y.Map in the document's Y.Doc,
 * so everyone in the live room sees changes at once and they are saved with
 * the document, and every change is also sent to the app's `threads`
 * adapter, which notifies mentioned people and lets other clients load them.
 *
 * Shape in the Y.Doc ("lexical-comment-threads", keyed by thread id):
 *   thread:  { id, quote, anchor, createdAt, resolved, comments: Y.Array<comment> }
 *   comment: { id, authorId, authorName, authorAvatar, body, createdAt,
 *              editedAt?, deleted, reactions: Y.Map<"userId emoji", reaction> }
 */

const THREADS_KEY = "lexical-comment-threads";
export const HYDRATE_ORIGIN = "jaggle:threads-hydrate";

export type CommentAuthor = { id: string; name: string; avatarUrl?: string | null };

export type ThreadActions = {
  me: CommentAuthor;
  createThread: (input: {
    id: string;
    quote: string;
    anchor: "text" | "media";
    body: CommentBody;
  }) => void;
  reply: (threadId: string, body: CommentBody) => void;
  edit: (threadId: string, commentId: string, body: CommentBody) => void;
  deleteComment: (threadId: string, commentId: string) => void;
  deleteThread: (threadId: string) => void;
  setResolved: (threadId: string, resolved: boolean) => void;
  toggleReaction: (threadId: string, commentId: string, emoji: string) => void;
};

export function createId(): string {
  return crypto.randomUUID();
}

function readComment(map: Y.Map<unknown>): Comment {
  const reactions = new Map<string, CommentReaction>();
  const reactionMap = map.get("reactions");
  if (reactionMap instanceof Y.Map) {
    for (const value of reactionMap.values() as IterableIterator<{
      emoji: string;
      userId: string;
      userName?: string;
    }>) {
      const entry = reactions.get(value.emoji) ?? { emoji: value.emoji, userIds: [], names: [] };
      entry.userIds.push(value.userId);
      entry.names.push(value.userName ?? "");
      reactions.set(value.emoji, entry);
    }
  }
  const deleted = map.get("deleted") === true;
  return {
    type: "comment",
    id: String(map.get("id")),
    author: String(map.get("authorName") ?? ""),
    authorId: String(map.get("authorId") ?? ""),
    authorAvatar: (map.get("authorAvatar") as string | null | undefined) ?? null,
    body: deleted ? null : ((map.get("body") as CommentBody | undefined) ?? null),
    deleted,
    timeStamp: Number(map.get("createdAt") ?? 0),
    editedAt: (map.get("editedAt") as number | undefined) ?? undefined,
    reactions: Array.from(reactions.values()),
  };
}

function readThread(map: Y.Map<unknown>): Thread {
  const comments = map.get("comments");
  return {
    type: "thread",
    id: String(map.get("id")),
    quote: String(map.get("quote") ?? ""),
    anchor: map.get("anchor") === "media" ? "media" : "text",
    resolved: map.get("resolved") === true,
    comments:
      comments instanceof Y.Array
        ? (comments.toArray() as Y.Map<unknown>[]).map(readComment)
        : [],
  };
}

function commentMap(input: {
  id: string;
  author: CommentAuthor;
  body: CommentBody;
  createdAt: number;
  editedAt?: number;
  reactions?: EditorThreadComment["reactions"];
  reactionNames?: Map<string, string>;
}) {
  const map = new Y.Map<unknown>();
  map.set("id", input.id);
  map.set("authorId", input.author.id);
  map.set("authorName", input.author.name);
  map.set("authorAvatar", input.author.avatarUrl ?? null);
  map.set("body", input.body);
  map.set("createdAt", input.createdAt);
  if (input.editedAt) map.set("editedAt", input.editedAt);
  map.set("deleted", false);
  const reactions = new Y.Map<unknown>();
  for (const reaction of input.reactions ?? []) {
    for (const userId of reaction.userIds) {
      reactions.set(`${userId} ${reaction.emoji}`, {
        emoji: reaction.emoji,
        userId,
        userName: input.reactionNames?.get(userId) ?? "",
      });
    }
  }
  map.set("reactions", reactions);
  return map;
}

function threadMap(input: {
  id: string;
  quote: string;
  anchor: "text" | "media";
  createdAt: number;
  resolved: boolean;
  comments: Y.Map<unknown>[];
}) {
  const map = new Y.Map<unknown>();
  map.set("id", input.id);
  map.set("quote", input.quote);
  map.set("anchor", input.anchor);
  map.set("createdAt", input.createdAt);
  map.set("resolved", input.resolved);
  const comments = new Y.Array<Y.Map<unknown>>();
  comments.push(input.comments);
  map.set("comments", comments);
  return map;
}

/** The thread list, oldest first. */
export function readThreads(doc: Y.Doc): Thread[] {
  const threads = doc.getMap<Y.Map<unknown>>(THREADS_KEY);
  return Array.from(threads.values())
    .map((map) => ({ map, createdAt: Number(map.get("createdAt") ?? 0) }))
    .sort((left, right) => left.createdAt - right.createdAt)
    .map(({ map }) => readThread(map));
}

export function observeThreads(doc: Y.Doc, onChange: () => void): () => void {
  const threads = doc.getMap<Y.Map<unknown>>(THREADS_KEY);
  threads.observeDeep(onChange);
  return () => threads.unobserveDeep(onChange);
}

/** Where a saved document's threads are mirrored: the app's `threads` adapter. */
export type ThreadSync = { identity: DocumentIdentity; api: ThreadsAdapter };

/**
 * Comment actions on the Y.Doc, mirrored to the app when the document is
 * saved and the app has a `threads` adapter (`sync`). Without one, comments
 * live in the document only.
 */
export function createThreadActions(
  doc: Y.Doc,
  me: CommentAuthor,
  sync: ThreadSync | null,
  notify: EditorNotify,
): ThreadActions {
  const identity = sync?.identity;
  const api = sync?.api;
  const backendSync = (send: (api: ThreadsAdapter, identity: DocumentIdentity) => Promise<unknown>, message: string) => {
    if (!api || !identity) return;
    send(api, identity).catch(() => notify.error(message));
  };
  const threads = doc.getMap<Y.Map<unknown>>(THREADS_KEY);
  const findComment = (threadId: string, commentId: string) => {
    const comments = threads.get(threadId)?.get("comments");
    if (!(comments instanceof Y.Array)) return null;
    return (
      (comments.toArray() as Y.Map<unknown>[]).find((map) => map.get("id") === commentId) ?? null
    );
  };

  return {
    me,
    createThread: ({ id, quote, anchor, body }) => {
      const commentId = createId();
      doc.transact(() => {
        threads.set(
          id,
          threadMap({
            id,
            quote,
            anchor,
            createdAt: Date.now(),
            resolved: false,
            comments: [commentMap({ id: commentId, author: me, body, createdAt: Date.now() })],
          }),
        );
      });
      backendSync(
        (api, identity) =>
          api.create(identity, {
            id,
            initialComment: { id: commentId, body },
            metadata: { anchor, quote },
            mentionedUserIds: mentionedUserIds(body.state),
          }),
        "Couldn't save the comment.",
      );
    },
    reply: (threadId, body) => {
      const comments = threads.get(threadId)?.get("comments");
      if (!(comments instanceof Y.Array)) return;
      const id = createId();
      doc.transact(() => {
        comments.push([commentMap({ id, author: me, body, createdAt: Date.now() })]);
      });
      backendSync(
        (api, identity) =>
          api.addComment(identity, threadId, {
            id,
            body,
            mentionedUserIds: mentionedUserIds(body.state),
          }),
        "Couldn't save the reply.",
      );
    },
    edit: (threadId, commentId, body) => {
      const comment = findComment(threadId, commentId);
      if (!comment || comment.get("authorId") !== me.id) return;
      doc.transact(() => {
        comment.set("body", body);
        comment.set("editedAt", Date.now());
      });
      // Every mention, not only new ones: the backend replaces the stored set.
      backendSync(
        (api, identity) =>
          api.updateComment(identity, threadId, commentId, {
            body,
            mentionedUserIds: mentionedUserIds(body.state),
          }),
        "Couldn't save the edit.",
      );
    },
    deleteComment: (threadId, commentId) => {
      const comment = findComment(threadId, commentId);
      if (!comment) return;
      doc.transact(() => {
        comment.set("deleted", true);
        comment.delete("body");
      });
      backendSync(
        (api, identity) => api.deleteComment(identity, threadId, commentId),
        "Couldn't delete the comment.",
      );
    },
    deleteThread: (threadId) => {
      doc.transact(() => threads.delete(threadId));
      backendSync(
        (api, identity) => api.deleteThread(identity, threadId),
        "Couldn't delete the thread.",
      );
    },
    setResolved: (threadId, resolved) => {
      const thread = threads.get(threadId);
      if (!thread) return;
      doc.transact(() => thread.set("resolved", resolved));
      backendSync(
        (api, identity) => api.setResolved(identity, threadId, resolved),
        "Couldn't update the thread.",
      );
    },
    toggleReaction: (threadId, commentId, emoji) => {
      const reactions = findComment(threadId, commentId)?.get("reactions");
      if (!(reactions instanceof Y.Map)) return;
      const key = `${me.id} ${emoji}`;
      const remove = reactions.has(key);
      doc.transact(() => {
        if (remove) reactions.delete(key);
        else reactions.set(key, { emoji, userId: me.id, userName: me.name });
      });
      backendSync(
        (api, identity) =>
          remove
            ? api.removeReaction(identity, threadId, commentId, emoji)
            : api.addReaction(identity, threadId, commentId, emoji),
        "Couldn't update the reaction.",
      );
    },
  };
}

function authorOf(comment: EditorThreadComment, me: CommentAuthor): CommentAuthor {
  if (comment.author) {
    return { id: comment.author.id, name: comment.author.name, avatarUrl: comment.author.avatar_url };
  }
  if (comment.userId === me.id) return me;
  return { id: comment.userId, name: "Unknown", avatarUrl: null };
}

function quoteOf(thread: EditorThread): { quote: string; anchor: "text" | "media" } {
  const metadata = thread.metadata as { quote?: unknown; anchor?: unknown } | null | undefined;
  return {
    quote: typeof metadata?.quote === "string" ? metadata.quote : "",
    anchor: metadata?.anchor === "media" ? "media" : "text",
  };
}

/**
 * Adds threads the app has but the Y.Doc doesn't (a migrated document's
 * threads, or ones written while nobody had the document open).
 */
export async function hydrateThreads(
  doc: Y.Doc,
  { identity, api }: ThreadSync,
  me: CommentAuthor,
): Promise<void> {
  const remote = await api.list(identity);
  const threads = doc.getMap<Y.Map<unknown>>(THREADS_KEY);
  const missing = remote.filter((thread) => !threads.has(thread.id));
  if (missing.length === 0) return;
  doc.transact(() => {
    for (const thread of missing) {
      const names = new Map(
        thread.comments.map((comment) => {
          const author = authorOf(comment, me);
          return [author.id, author.name] as const;
        }),
      );
      threads.set(
        thread.id,
        threadMap({
          id: thread.id,
          ...quoteOf(thread),
          createdAt: Date.parse(thread.createdAt),
          resolved: thread.resolved,
          comments: thread.comments.map((comment) =>
            commentMap({
              id: comment.id,
              author: authorOf(comment, me),
              body: comment.body as CommentBody,
              createdAt: Date.parse(comment.createdAt),
              editedAt:
                comment.updatedAt && comment.updatedAt !== comment.createdAt
                  ? Date.parse(comment.updatedAt)
                  : undefined,
              reactions: comment.reactions,
              reactionNames: names,
            }),
          ),
        }),
      );
    }
  }, HYDRATE_ORIGIN);
}
