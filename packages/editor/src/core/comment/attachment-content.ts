import type { SerializedEditorState, SerializedLexicalNode } from "lexical";

import { getAttachmentIdFromReference } from "../../lib/file-url";

export type CommentAttachment = {
  kind: "image" | "video" | "audio" | "file";
  src: string;
  name: string;
  attachmentId?: string;
  mimeType?: string;
  size?: number;
};

type AttachmentNode = {
  type?: string;
  src?: string;
  name?: string;
  altText?: string;
  attachmentId?: string;
  mimeType?: string;
  children?: AttachmentNode[];
};

const KINDS = new Set<CommentAttachment["kind"]>([
  "image",
  "video",
  "audio",
  "file",
]);

function isSafeSource(src: string, kind: CommentAttachment["kind"]) {
  if (getAttachmentIdFromReference(src)) return true;
  try {
    const url = new URL(src, "https://comment.local");
    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "blob:" ||
      (kind === "image" &&
        url.protocol === "data:" &&
        /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src))
    );
  } catch {
    return false;
  }
}

function attachmentFromNode(node: AttachmentNode): CommentAttachment | null {
  const kind = node.type;
  if (
    !kind ||
    !KINDS.has(kind as CommentAttachment["kind"]) ||
    !node.src ||
    !isSafeSource(node.src, kind as CommentAttachment["kind"])
  ) {
    return null;
  }
  return {
    kind: kind as CommentAttachment["kind"],
    src: node.src,
    name: node.name || node.altText || "Attachment",
    attachmentId: node.attachmentId,
    mimeType: node.mimeType,
  };
}

export function splitCommentEditorState(state?: SerializedEditorState) {
  if (!state) return { editorState: undefined, attachment: null };

  const editorState = structuredClone(state);
  let attachment: CommentAttachment | null = null;
  const removeAttachments = (node: AttachmentNode) => {
    if (!node.children) return;
    node.children = node.children.filter((child) => {
      const found = attachmentFromNode(child);
      if (child.type && KINDS.has(child.type as CommentAttachment["kind"])) {
        if (found) attachment ??= found;
        return false;
      }
      removeAttachments(child);
      return true;
    });
  };
  removeAttachments(editorState.root as AttachmentNode);

  return {
    editorState: editorState.root.children.length ? editorState : undefined,
    attachment,
  };
}

export function attachmentFromElement(element: Element): CommentAttachment | null {
  const tag = element.tagName.toLowerCase();
  const kind =
    tag === "img"
      ? "image"
      : tag === "video"
        ? "video"
        : tag === "audio"
          ? "audio"
          : tag === "a" && element.hasAttribute("data-lexical-file")
            ? "file"
            : null;
  if (!kind) return null;

  const src =
    element.getAttribute(tag === "a" ? "href" : "src") ||
    element.querySelector("source")?.getAttribute("src");
  if (!src || !isSafeSource(src, kind)) return null;
  return {
    kind,
    src,
    name:
      element.getAttribute("data-name") ||
      element.getAttribute("alt") ||
      element.textContent?.trim() ||
      "Attachment",
    attachmentId: element.getAttribute("data-attachment-id") || undefined,
    mimeType: element.getAttribute("data-mime-type") || undefined,
  };
}

export function splitCommentHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  let attachment: CommentAttachment | null = null;
  for (const element of document.body.querySelectorAll(
    "img, video, audio, a[data-lexical-file]",
  )) {
    const found = attachmentFromElement(element);
    if (found) attachment ??= found;
    element.remove();
  }
  return { html: document.body.innerHTML, attachment };
}

export function appendCommentAttachment(
  state: SerializedEditorState,
  html: string,
  attachment: CommentAttachment | null,
) {
  if (!attachment) return { editorState: state, html };

  const { kind, src, name, attachmentId, mimeType } = attachment;
  const node =
    kind === "image"
      ? {
          type: "image",
          version: 1,
          src,
          altText: name,
          attachmentId,
          maxWidth: 800,
        }
      : {
          type: kind,
          version: 1,
          format: "",
          src,
          name,
          attachmentId,
          mimeType,
        };
  const editorState = structuredClone(state);
  editorState.root.children.push(node as SerializedLexicalNode);

  const element = document.createElement(
    kind === "image" ? "img" : kind === "file" ? "a" : kind,
  );
  element.setAttribute(kind === "file" ? "href" : "src", src);
  if (attachmentId) element.setAttribute("data-attachment-id", attachmentId);
  if (mimeType) element.setAttribute("data-mime-type", mimeType);
  if (kind === "image") {
    element.setAttribute("alt", name);
  } else {
    element.setAttribute("data-name", name);
    if (kind === "file") {
      element.setAttribute("data-lexical-file", src);
      element.textContent = name;
    } else {
      element.setAttribute(`data-lexical-${kind}`, src);
      element.setAttribute("controls", "true");
    }
  }

  return { editorState, html: html + element.outerHTML };
}
