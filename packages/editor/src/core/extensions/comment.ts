import { effect, namedSignals } from "@lexical/extension";
import {
  $createMarkNode,
  $getMarkIDs,
  $isMarkNode,
  $unwrapMarkNode,
  MarkExtension,
  MarkNode,
} from "@lexical/mark";
import { mergeRegister, registerNestedElementResolver } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $getState,
  $setState,
  COLLABORATION_TAG,
  createState,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  getDOMSelection,
  type LexicalCommand,
  type LexicalEditor,
  type NodeKey,
  type RangeSelection,
} from "lexical";

import type { CommentBody } from "../lib/types";

export type CommentReaction = {
  emoji: string;
  userIds: string[];
  /** Display names, in the same order as `userIds`. */
  names: string[];
};

export type Comment = {
  author: string;
  authorId: string;
  authorAvatar: string | null;
  /** Null once the comment is deleted. */
  body: CommentBody | null;
  deleted: boolean;
  id: string;
  timeStamp: number;
  editedAt?: number;
  reactions: CommentReaction[];
  type: "comment";
};

export type Thread = {
  /** The media block it is on (resolved from `commentThreadsState`), for media threads. */
  anchorNodeKey?: NodeKey;
  anchor: "text" | "media";
  comments: Comment[];
  id: string;
  quote: string;
  resolved: boolean;
  type: "thread";
};

export type Comments = Thread[];

/**
 * The threads on a media block (image, video, file, embed, board…). A media
 * block can't hold a comment mark, so it carries the thread ids itself; node
 * state is saved with the document and synced in the live room, unlike node
 * keys, which differ per browser.
 */
export const commentThreadsState = createState("commentThreads", {
  parse: (value) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [],
});

function createCommentState() {
  return {
    ...namedSignals({
      activeAnchorKey: null as NodeKey | null,
      activeIDs: [] as string[],
      /** Threads with their media anchors: what the comment UI shows. */
      comments: [] as Comments,
      /** Threads as stored (set by the thread store). */
      threads: [] as Comments,
      mediaAnchors: new Map<string, NodeKey>(),
      mediaAnchorRevision: 0,
      showCommentInput: false,
    }),
    markNodeMap: new Map<string, Set<NodeKey>>(),
    pendingMediaAnchor: null as { nodeKey: NodeKey; quote: string } | null,
    pendingSelection: null as RangeSelection | null,
    /** The selection the comment field opened for; it stays open until that changes. */
    inputSelection: null as RangeSelection | null,
  };
}

export type CommentState = ReturnType<typeof createCommentState>;

/** Shows a new set of stored threads (from the thread store). */
export function setThreads(state: CommentState, threads: Comments): void {
  state.threads.value = threads;
}

/** Adds a thread id to a media block. */
export function $addMediaThread(nodeKey: NodeKey, threadId: string): void {
  const node = $getNodeByKey(nodeKey);
  if (node) {
    $setState(node, commentThreadsState, (ids) => [...ids, threadId]);
  }
}

/** Removes a thread's highlight (text) or its id on a media block. */
export function removeThreadMarks(
  editor: LexicalEditor,
  state: CommentState,
  id: string,
): void {
  const markNodeKeys = state.markNodeMap.get(id);
  const mediaKey = state.mediaAnchors.peek().get(id);
  if (markNodeKeys === undefined && mediaKey === undefined) {
    return;
  }
  setTimeout(() => {
    editor.update(() => {
      for (const key of markNodeKeys ?? []) {
        const node = $getNodeByKey(key);
        if ($isMarkNode(node)) {
          node.deleteID(id);
          if (node.getIDs().length === 0) {
            $unwrapMarkNode(node);
          }
        }
      }
      const media = mediaKey ? $getNodeByKey(mediaKey) : null;
      if (media) {
        $setState(media, commentThreadsState, (ids) => ids.filter((threadId) => threadId !== id));
      }
    });
  });
}

export function consumePendingSelection(
  state: CommentState,
): RangeSelection | null {
  const selection = state.pendingSelection;
  state.pendingSelection = null;
  return selection;
}

export const INSERT_INLINE_COMMAND: LexicalCommand<void> = createCommand(
  "INSERT_INLINE_COMMAND",
);
export const INSERT_MEDIA_COMMENT_COMMAND: LexicalCommand<{
  nodeKey: NodeKey;
  quote: string;
}> = createCommand("INSERT_MEDIA_COMMENT_COMMAND");

export const CLOSE_COMMENT_INPUT_COMMAND: LexicalCommand<void> = createCommand(
  "CLOSE_COMMENT_INPUT_COMMAND",
);

export const CommentExtension = defineExtension({
  name: "@jaggle/lexical/comment",
  dependencies: [MarkExtension],
  build: createCommentState,
  register: (editor, _config, state) => {
    const output = state.getOutput();
    const { markNodeMap } = output;
    const markNodeKeysToIDs = new Map<NodeKey, string[]>();

    return mergeRegister(
      registerNestedElementResolver<MarkNode>(
        editor,
        MarkNode,
        (from) => $createMarkNode(from.getIDs()),
        (from, to) => {
          for (const id of from.getIDs()) {
            to.addID(id);
          }
        },
      ),

      editor.registerMutationListener(
        MarkNode,
        (mutations) => {
          editor.read("latest", () => {
            for (const [key, mutation] of mutations) {
              const node = $getNodeByKey(key);
              let ids: string[] = [];

              if (mutation === "destroyed") {
                ids = markNodeKeysToIDs.get(key) ?? [];
              } else if ($isMarkNode(node)) {
                ids = node.getIDs();
              }

              for (const id of ids) {
                let markNodeKeys = markNodeMap.get(id);
                markNodeKeysToIDs.set(key, ids);

                if (mutation === "destroyed") {
                  if (markNodeKeys !== undefined) {
                    markNodeKeys.delete(key);
                    if (markNodeKeys.size === 0) {
                      markNodeMap.delete(id);
                    }
                  }
                } else {
                  if (markNodeKeys === undefined) {
                    markNodeKeys = new Set();
                    markNodeMap.set(id, markNodeKeys);
                  }
                  markNodeKeys.add(key);
                }
              }
            }
          });
        },
        { skipInitialization: false },
      ),

      // The comment list: stored threads, each media thread with the block it
      // is on now. A thread whose highlight or block is gone stays listed.
      effect(() => {
        const anchors = output.mediaAnchors.value;
        output.comments.value = output.threads.value.map((thread) => {
          const anchorNodeKey = anchors.get(thread.id);
          return anchorNodeKey === thread.anchorNodeKey ? thread : { ...thread, anchorNodeKey };
        });
      }),

      editor.registerUpdateListener(({ editorState, tags }) => {
        // Someone else's edit in the live room isn't this person moving on.
        const remote = tags.has(COLLABORATION_TAG);
        editorState.read(() => {
          const anchors = new Map<string, NodeKey>();
          editorState._nodeMap.forEach((node, key) => {
            for (const id of $getState(node, commentThreadsState)) {
              anchors.set(id, key);
            }
          });
          const previous = output.mediaAnchors.peek();
          if (
            anchors.size !== previous.size ||
            Array.from(anchors).some(([id, key]) => previous.get(id) !== key)
          ) {
            output.mediaAnchors.value = anchors;
          }

          const selection = $getSelection();
          let hasActiveIds = false;
          let hasAnchorKey = false;

          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();

            if ($isTextNode(anchorNode)) {
              const commentIDs = $getMarkIDs(
                anchorNode,
                selection.anchor.offset,
              );
              if (commentIDs !== null) {
                output.activeIDs.value = commentIDs;
                hasActiveIds = true;
              }
              if (!selection.isCollapsed()) {
                output.activeAnchorKey.value = anchorNode.getKey();
                hasAnchorKey = true;
              }
            }
          } else if ($isNodeSelection(selection)) {
            // A selected image or media block activates the threads on it.
            const ids = selection
              .getNodes()
              .flatMap((node) => $getState(node, commentThreadsState));
            if (ids.length > 0) {
              output.activeIDs.value = ids;
              hasActiveIds = true;
            }
          }
          if (!hasActiveIds && output.activeIDs.peek().length > 0) {
            output.activeIDs.value = [];
          }
          if (!hasAnchorKey) {
            output.activeAnchorKey.value = null;
          }
          // Moving the selection closes the comment field. Updates that leave
          // it where it was (the live room refreshing cursors) don't.
          if (
            !remote &&
            $isRangeSelection(selection) &&
            output.pendingSelection === null &&
            output.pendingMediaAnchor === null &&
            !(output.inputSelection !== null && selection.is(output.inputSelection))
          ) {
            output.inputSelection = null;
            output.showCommentInput.value = false;
          }
        });
      }),

      editor.registerCommand(
        INSERT_INLINE_COMMAND,
        () => {
          editor.read("latest", () => {
            const selection = $getSelection();
            output.pendingSelection = $isRangeSelection(selection)
              ? selection.clone()
              : null;
            output.inputSelection = output.pendingSelection?.clone() ?? null;
          });
          const domSelection = getDOMSelection(editor._window);
          if (domSelection !== null) {
            domSelection.removeAllRanges();
          }
          output.showCommentInput.value = true;
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      editor.registerCommand(
        INSERT_MEDIA_COMMENT_COMMAND,
        ({ nodeKey, quote }) => {
          output.pendingSelection = null;
          output.pendingMediaAnchor = { nodeKey, quote };
          output.mediaAnchorRevision.value += 1;
          const domSelection = getDOMSelection(editor._window);
          if (domSelection !== null) {
            domSelection.removeAllRanges();
          }
          output.showCommentInput.value = true;
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      editor.registerCommand(
        CLOSE_COMMENT_INPUT_COMMAND,
        () => {
          output.pendingSelection = null;
          output.pendingMediaAnchor = null;
          output.inputSelection = null;
          output.showCommentInput.value = false;
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      effect(() => {
        const activeIDs = output.activeIDs.value;
        const changedElems: HTMLElement[] = [];
        for (const id of activeIDs) {
          const keys = markNodeMap.get(id);
          if (keys !== undefined) {
            for (const key of keys) {
              const elem = editor.getElementByKey(key);
              if (elem !== null) {
                elem.classList.add("selected");
                changedElems.push(elem);
              }
            }
          }
        }
        return () => {
          for (const elem of changedElems) {
            elem.classList.remove("selected");
          }
        };
      }),
    );
  },
});
