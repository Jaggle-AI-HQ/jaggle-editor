"use client";

import DOMPurify from "dompurify";

import { splitCommentHtml } from "../comment/attachment-content";
import { CommentAttachmentView } from "../comment/attachment-view";
import { useIsClient } from "../lib/use-is-client";

import { RichHtml } from "./rich-html";

const YOUTUBE_EMBED_SRC =
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/;

/**
 * DOMPurify's default URL schemes plus `jaggle-file:`, the stored-file
 * reference images and files are saved with. Without it the sanitizer drops
 * an image's `src`, and read-only views show a broken image.
 */
const ALLOWED_URI =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|jaggle-file):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

let purifier: ReturnType<typeof DOMPurify> | null = null;

/**
 * A sanitizer of its own (hooks on the shared DOMPurify instance would leak to
 * other callers). It keeps YouTube embeds, which the editor exports as
 * nocookie iframes, and drops any other iframe.
 */
function sanitize(html: string): string {
  if (!purifier) {
    purifier = DOMPurify(window);
    purifier.addHook("uponSanitizeElement", (node, data) => {
      if (
        data.tagName === "iframe" &&
        node instanceof Element &&
        !YOUTUBE_EMBED_SRC.test(node.getAttribute("src") ?? "")
      ) {
        node.remove();
      }
    });
  }
  return purifier.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "target"],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  });
}


export function HtmlView({
  html,
  commentPreview = false,
  className,
}: {
  html?: string;
  commentPreview?: boolean;
  /** Comment previews default to `text-sm`; pass a class to change it. */
  className?: string;
}) {
  const isClient = useIsClient();
  const content = isClient && commentPreview && html ? splitCommentHtml(html) : null;
  const clean = isClient && html ? sanitize(content?.html ?? html) : "";

  if (!isClient) return <div className="h-6" />;
  if (!commentPreview) {
    return clean ? (
      <RichHtml html={clean} />
    ) : (
      <p className="text-muted-foreground">Nothing to show.</p>
    );
  }

  const bodyHtml = clean;

  if (!bodyHtml && !content?.attachment) {
    return <p className="text-muted-foreground">Nothing to show.</p>;
  }

  return (
    <div>
      {bodyHtml ? (
        <RichHtml html={bodyHtml} className={className} />
      ) : null}
      {content?.attachment ? (
        <CommentAttachmentView attachment={content.attachment} />
      ) : null}
    </div>
  );
}
