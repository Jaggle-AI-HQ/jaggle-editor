import type { SerializedEditorState, SerializedLexicalNode } from "lexical";

import type { CommentBody } from "./types";

/**
 * People mentioned in a comment, for notifications. Mentions of records
 * (documents, tasks) notify no one.
 */
export function mentionedUserIds(state: SerializedEditorState): string[] {
  const ids = new Set<string>();
  const visit = (node: SerializedLexicalNode & { children?: SerializedLexicalNode[] }) => {
    const mention = node as SerializedLexicalNode & { entityType?: string; entityId?: string };
    if (mention.type === "mention" && mention.entityType === "user" && mention.entityId) {
      ids.add(mention.entityId);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(state.root);
  return Array.from(ids);
}

/** What task and goal comment create/update requests carry. */
export type CommentPayload = {
  content: { format: "lexical"; state: SerializedEditorState };
  content_html: string;
  /** Real plain text (may be empty for an image alone). */
  plain_text: string;
  mentioned_user_ids: string[];
};

export function toCommentPayload(body: CommentBody): CommentPayload {
  return {
    content: { format: "lexical", state: body.state },
    content_html: body.html,
    plain_text: body.text,
    mentioned_user_ids: mentionedUserIds(body.state),
  };
}

/** The comment the composer submits, as one value. */
export function commentBody(
  state: SerializedEditorState,
  html: string,
  text: string,
): CommentBody {
  return { format: "lexical", state, html, text };
}

/**
 * A comment draft that starts by mentioning someone (replying to a reply
 * mentions its author), for the composer's `initialEditorState`.
 */
export function mentionDraft(user: { id: string; name: string }): SerializedEditorState {
  return {
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: [
        {
          type: "paragraph",
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
          children: [
            {
              type: "mention",
              version: 1,
              entityType: "user",
              entityId: user.id,
              title: user.name,
              href: "",
            },
            {
              type: "text",
              version: 1,
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: " ",
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}
