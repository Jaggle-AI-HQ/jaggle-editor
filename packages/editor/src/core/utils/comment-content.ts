import { $isLinkNode } from "@lexical/link";
import { $dfs } from "@lexical/utils";
import { $getRoot, $isTextNode, type SerializedEditorState } from "lexical";

import { getAttachmentIdFromReference } from "../../lib/file-url";

import { $isImageNode } from "../nodes/image-node";
import { $isAudioNode, $isFileNode, $isVideoNode } from "../nodes/media-node";
import { $isMentionNode } from "../nodes/mention-node";

export function $commentHasContent() {
  for (const { node } of $dfs()) {
    if ($isTextNode(node) && node.getTextContent().trim()) return true;
    if ($isMentionNode(node) && node.getTextContent().trim()) return true;
    if ($isImageNode(node) && node.getSrc()) return true;
    if (
      ($isVideoNode(node) || $isAudioNode(node) || $isFileNode(node)) &&
      node.getSrc()
    ) {
      return true;
    }
    if ($isLinkNode(node) && node.getURL().length > 0) return true;
  }

  return false;
}

type SerializedNode = {
  type?: string;
  src?: string;
  children?: SerializedNode[];
};

function stripNode(node: SerializedNode) {
  if (
    ["image", "video", "audio", "file"].includes(node.type ?? "") &&
    typeof node.src === "string" &&
    node.src.startsWith("blob:")
  ) {
    node.src = "";
  }
  node.children?.forEach(stripNode);
}

export function stripPreviewUrls(state: SerializedEditorState) {
  const clone = structuredClone(state);
  stripNode(clone.root as SerializedNode);
  return clone;
}

/**
 * The posted comment's HTML links attachments by the app's lasting URL
 * (`files.rawUrl`); without one, references stay as they are.
 */
export async function commentHtmlWithFileUrls(
  html: string,
  rawUrl: ((attachmentId: string) => Promise<string>) | undefined,
) {
  if (!rawUrl) return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const replacements: Promise<void>[] = [];
  for (const element of document.body.querySelectorAll("[src], [href]")) {
    for (const attribute of ["src", "href"] as const) {
      const attachmentId = getAttachmentIdFromReference(
        element.getAttribute(attribute) ?? "",
      );
      if (attachmentId) {
        replacements.push(
          rawUrl(attachmentId).then((url) => {
            element.setAttribute(attribute, url);
          }),
        );
      }
    }
  }
  await Promise.all(replacements);
  return document.body.innerHTML;
}

export function $commentPlainText() {
  return $getRoot().getTextContent();
}
