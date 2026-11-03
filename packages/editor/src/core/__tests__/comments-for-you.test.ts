import { describe, expect, it } from "vitest";

import type { Comment, Thread } from "../extensions/comment";
import { isThreadForMe } from "../plugins/floating/comment-plugin";

function comment(authorId: string, html = "<p>Looks good</p>", deleted = false): Comment {
  return {
    author: authorId,
    authorId,
    authorAvatar: null,
    body: deleted ? null : { format: "lexical", state: { root: {} } as never, html, text: "" },
    deleted,
    id: `${authorId}-${html.length}`,
    timeStamp: 0,
    reactions: [],
    type: "comment",
  };
}

function thread(comments: Comment[]): Thread {
  return { anchor: "text", comments, id: "t1", quote: "Plan", resolved: false, type: "thread" };
}

describe("For you", () => {
  it("has threads someone wrote in or is @mentioned in", () => {
    const mention = '<p><span data-lexical-mention="" data-entity-type="user" data-entity-id="me">@Me</span> see this</p>';
    expect(isThreadForMe(thread([comment("ana"), comment("me")]), "me")).toBe(true);
    expect(isThreadForMe(thread([comment("ana", mention)]), "me")).toBe(true);
  });

  it("leaves out others' threads and comments they deleted", () => {
    expect(isThreadForMe(thread([comment("ana"), comment("bo")]), "me")).toBe(false);
    expect(isThreadForMe(thread([comment("ana"), comment("me", "", true)]), "me")).toBe(false);
  });
});
