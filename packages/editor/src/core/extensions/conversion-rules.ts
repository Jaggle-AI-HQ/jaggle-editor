import {
  BlockSchema,
  type CompiledSelector,
  CoreImportExtension,
  defineImportRule,
  DOMImportExtension,
  sel,
} from "@lexical/html";
import { $createMarkNode } from "@lexical/mark";
import { getCSSFromStyleObject, getStyleObjectFromCSS } from "@lexical/selection";
import {
  $isElementNode,
  $isTextNode,
  $setState,
  configExtension,
  defineExtension,
  type DOMConversionOutput,
  type LexicalNode,
} from "lexical";

import { $convertEquationElement } from "../nodes/equation-node";
import { $convertImageElement } from "../nodes/image-node";
import {
  $convertLayoutContainerElement,
  $convertLayoutItemElement,
} from "../nodes/layout-node";
import {
  $convertAudioElement,
  $convertFileElement,
  $convertVideoElement,
} from "../nodes/media-node";
import { $convertMentionElement } from "../nodes/mention-node";
import {
  $convertToggleContentElement,
  $convertToggleElement,
  $convertToggleTitleElement,
} from "../nodes/toggle-node";
import { $convertTweetElement } from "../nodes/tweet-node";
import { $convertYouTubeElement } from "../nodes/youtube-node";

import { commentThreadsState } from "./comment";

/**
 * Runs a node's classic `importDOM` conversion inside the rule-based HTML
 * importer (`DOMImportExtension`). The two importers do not see each other's
 * conversions, so nodes ported with `importDOM` need a rule to survive paste.
 * `children` imports the element's children into the created element node.
 */
export function conversionRule(
  name: string,
  match: CompiledSelector<HTMLElement>,
  $convert: (element: HTMLElement) => DOMConversionOutput | null,
  children?: "block" | "inline",
) {
  return defineImportRule({
    name,
    match,
    $import: (ctx, el, $next) => {
      const node = $convert(el)?.node;
      if (!node || Array.isArray(node)) {
        return $next();
      }
      if (children && $isElementNode(node)) {
        node.splice(
          node.getChildrenSize(),
          0,
          ctx.$importChildren(
            el,
            children === "block" ? { schema: BlockSchema } : undefined,
          ),
        );
      }
      return [node];
    },
  });
}

/**
 * Comment thread ids written in HTML as `data-thread-ids="a,b"`: on a `<span>`
 * around commented text, or on a commented image, video, audio or file
 * element. The editor's own HTML never writes them (Lexical's comment marks
 * have no HTML form); content converted from the old editor does, so its
 * threads stay attached when the editor first imports it.
 */
const THREAD_IDS_ATTRIBUTE = "data-thread-ids";

function threadIdsOf(element: HTMLElement): string[] {
  return (element.getAttribute(THREAD_IDS_ATTRIBUTE) ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Commented text: the span's content inside a comment mark with those ids. */
const CommentAnchorImportRule = defineImportRule({
  name: "@jaggle/lexical/comment-anchor-import",
  match: sel.tag("span").attr(THREAD_IDS_ATTRIBUTE, true),
  $import: (ctx, el, $next) => {
    const ids = threadIdsOf(el);
    if (ids.length === 0) return $next();
    const children = ctx.$importChildren(el);
    if (children.length === 0) return [];
    const mark = $createMarkNode(ids);
    mark.append(...children);
    return [mark];
  },
});

/** Spans that mean something else (a mention, a comment anchor, a date, an equation). */
const SPECIAL_SPAN_ATTRIBUTES = [
  "data-lexical-mention",
  THREAD_IDS_ATTRIBUTE,
  "data-lexical-datetime",
  "data-lexical-equation",
];

/** Adds a style property to every text node in `nodes`, without overriding one they set themselves. */
function $addTextStyle(nodes: readonly LexicalNode[], property: string, value: string) {
  for (const node of nodes) {
    if ($isTextNode(node)) {
      const style = getStyleObjectFromCSS(node.getStyle());
      if (!style[property]) {
        node.setStyle(getCSSFromStyleObject({ ...style, [property]: value }));
      }
    } else if ($isElementNode(node)) {
      $addTextStyle(node.getChildren(), property, value);
    }
  }
}

/**
 * Text and background colour from a `<span style="color: …">` /
 * `background-color: …` (the editor's colours, and other apps' pasted HTML).
 * The default importer keeps bold, italic and the like from a span's style,
 * but not its colours.
 */
function textStyleImportRule(property: "color" | "background-color") {
  return defineImportRule({
    name: `@jaggle/lexical/text-${property}-import`,
    match: sel.tag("span").styleAny(property, /.+/),
    $import: (_ctx, el, $next) => {
      const nodes = $next();
      const value = el.style.getPropertyValue(property).trim();
      if (value && !SPECIAL_SPAN_ATTRIBUTES.some((name) => el.hasAttribute(name))) {
        $addTextStyle(nodes, property, value);
      }
      return nodes;
    },
  });
}

/** A media conversion that also keeps the element's comment thread ids. */
function withThreadAnchors(
  $convert: (element: HTMLElement) => DOMConversionOutput | null,
) {
  return (element: HTMLElement): DOMConversionOutput | null => {
    const output = $convert(element);
    const ids = threadIdsOf(element);
    const node = output?.node;
    if (node && !Array.isArray(node) && ids.length > 0) {
      $setState(node as LexicalNode, commentThreadsState, ids);
    }
    return output;
  };
}

/**
 * Rule-based import for every document node that only had a classic
 * `importDOM`. With these, `$generateNodesFromDOMViaExtension` (used for HTML
 * paste in document mode) covers every node. The classic `importDOM` stays for
 * the comment composer, which imports through `$generateNodesFromDOM`.
 */
export const ConversionImportExtension = defineExtension({
  name: "@jaggle/lexical/conversion-import",
  dependencies: [
    CoreImportExtension,
    configExtension(DOMImportExtension, {
      rules: [
        CommentAnchorImportRule,
        textStyleImportRule("color"),
        textStyleImportRule("background-color"),
        conversionRule(
          "@jaggle/lexical/mention-import",
          sel.tag("span").attr("data-lexical-mention", true),
          $convertMentionElement,
        ),
        conversionRule(
          "@jaggle/lexical/tweet-import",
          sel.tag("div").attr("data-lexical-tweet-id", true),
          $convertTweetElement,
        ),
        conversionRule(
          "@jaggle/lexical/toggle-import",
          sel.tag("div").attr("data-toggle", true),
          $convertToggleElement,
          "block",
        ),
        conversionRule(
          "@jaggle/lexical/toggle-title-import",
          sel.tag("div").attr("data-toggle-title", true),
          $convertToggleTitleElement,
          "inline",
        ),
        conversionRule(
          "@jaggle/lexical/toggle-content-import",
          sel.tag("div").attr("data-toggle-content", true),
          $convertToggleContentElement,
          "block",
        ),
        conversionRule(
          "@jaggle/lexical/image-import",
          sel.tag("img"),
          withThreadAnchors($convertImageElement),
        ),
        conversionRule(
          "@jaggle/lexical/youtube-import",
          sel.tag("iframe"),
          $convertYouTubeElement,
        ),
        conversionRule(
          "@jaggle/lexical/equation-import",
          sel.tag("span", "div").attr("data-lexical-equation", true),
          $convertEquationElement,
        ),
        conversionRule(
          "@jaggle/lexical/layout-container-import",
          sel.tag("div").styleAny("grid-template-columns", /.+/),
          $convertLayoutContainerElement,
          "block",
        ),
        conversionRule(
          "@jaggle/lexical/layout-item-import",
          sel.tag("div").attr("data-lexical-layout-item", true),
          $convertLayoutItemElement,
          "block",
        ),
        conversionRule(
          "@jaggle/lexical/video-import",
          sel.tag("video"),
          withThreadAnchors($convertVideoElement),
        ),
        conversionRule(
          "@jaggle/lexical/audio-import",
          sel.tag("audio"),
          withThreadAnchors($convertAudioElement),
        ),
        conversionRule(
          "@jaggle/lexical/file-import",
          sel.tag("a").attr("data-lexical-file", true),
          withThreadAnchors($convertFileElement),
        ),
      ],
    }),
  ],
});
