# Comment composer

`<LexicalEditor mode="comment" />` is a compact box for comments, replies and chat-like input. It has text
formatting, lists, links, code, tables, `@` mentions, emoji, and one attachment (an image or a file).

```tsx
import { LexicalEditor, commentBody, toCommentPayload } from "@jaggle-ai/editor";

function TaskCommentBox({ taskId, projectId }: { taskId: string; projectId: string }) {
  const createComment = useCreateTaskComment(taskId);
  return (
    <LexicalEditor
      mode="comment"
      mentionScope={{ type: "project", id: projectId }}
      imageScope={{ entityType: "task", entityId: taskId }}
      placeholder="Add a comment..."
      actionLabel="Comment"
      onComment={async (state, html, text) => {
        await createComment.mutateAsync(toCommentPayload(commentBody(state, html, text)));
      }}
    />
  );
}
```

## Posting

`onComment(editorState, html, plainText)` runs when the person presses the send button:

| Argument | |
|---|---|
| `editorState` | The comment as Lexical JSON, to edit it later |
| `html` | The comment as HTML, for display. An attachment's preview URL is replaced by a lasting link from `files.rawUrl`. |
| `plainText` | The text, for search and notifications. An image alone gives `""`. |

- If `onComment` returns a promise, the composer waits for it. When it resolves, the box is cleared. When it
  rejects, the draft is kept and the error's `message` is shown (or "Could not send the comment.").
- The send button is disabled while the comment is empty, and while an attachment uploads (it then reads
  "Uploading..."). A second press while a send is running is ignored.

Two helpers shape what the composer gives you:

- `commentBody(state, html, text)` returns a `CommentBody`, `{ format: "lexical", state, html, text }`. Comment
  threads store this.
- `toCommentPayload(body)` returns the body that jaggle-app-fe's task and goal comment APIs take:
  `{ content: { format, state }, content_html, plain_text, mentioned_user_ids }`. `mentioned_user_ids` is every
  person mentioned. Mentions of records (documents, tasks) notify no one.

## Mentions

Typing `@` lists people from the `people` adapter. In comment mode, pass **`mentionScope`**:

```tsx
mentionScope={{ type: "project", id: projectId }} // or { type: "workspace", id: workspaceId }
```

A comment composer doesn't fall back to `workspaceId`. (The document editor does, and so do the composers inside
its comment threads.) Without `mentionScope`, or without a `people` adapter, `@` lists nobody.

## Attachments

One image or file per comment, chosen with the paperclip, pasted, or dropped in:
- With `imageScope` and a `files` adapter, it uploads right away, with a progress bar and a cancel button. The
  content stores it as `jaggle-file://attachment/<id>`.
- Without them, it stays in the page as a local URL, which is only good for a preview.

`imageScope.fieldName` defaults to `"comment_image"` for comments.

## Editing an existing comment

Pass the stored content as the starting state, with Save and Cancel:

```tsx
<LexicalEditor
  mode="comment"
  initialEditorState={comment.state} // or html={comment.html}
  mentionScope={scope}
  imageScope={imageScope}
  autoFocus
  actionLabel="Save"
  cancelLabel="Cancel"
  onCancel={() => setEditing(false)}
  onComment={async (state, html, text) => {
    await updateComment(comment.id, commentBody(state, html, text));
    setEditing(false);
  }}
/>
```

The starting content is read once, when the composer is created. A stored attachment is shown as the comment's
attachment again.

## Replying with a mention

`mentionDraft(user)` is a starting state that mentions someone, for "Reply" buttons:

```tsx
import { mentionDraft } from "@jaggle-ai/editor";

<LexicalEditor
  key={replyTo?.id ?? "new"} // a new composer for each reply target
  mode="comment"
  initialEditorState={replyTo ? mentionDraft({ id: replyTo.authorId, name: replyTo.authorName }) : undefined}
  autoFocus
  mentionScope={scope}
  onComment={post}
/>
```

## Loading it only when needed

A page with many comment boxes (a list of tasks, say) can defer each one:

```tsx
<LexicalEditor mode="comment" deferUntilFocus mentionScope={scope} onComment={post} />
```

Until the box is focused it is a lightweight placeholder, in the same frame. On focus, the composer and the emoji
data load and the composer takes focus.

## Props

| Prop | Default | |
|---|---|---|
| `onComment` | none | Called with `(editorState, html, plainText)` on send |
| `mentionScope` | nobody | Who `@` lists |
| `imageScope` | none | Where the attachment uploads |
| `placeholder` | "Add a comment..." | The empty box's hint |
| `actionLabel` | "Send" | The send button's label |
| `cancelLabel` | "Cancel" | The cancel button's label, shown when `onCancel` is set |
| `onCancel` | none | Shows a cancel button |
| `initialEditorState` / `html` | empty | Starting content, read once |
| `autoFocus` | `false` | Focus the composer once it mounts |
| `deferUntilFocus` | `false` | A placeholder until focused |
| `containerClassName` | none | Extra classes on the box |

## Showing posted comments

Render the stored HTML read-only, in comment mode:

```tsx
<LexicalEditor mode="comment" readOnly html={comment.html} />
```

This loads no editor code. The text uses the comment size (`text-sm`), mentions render as chips with hover cards
(from `people.get`), and an attachment renders below the text.
