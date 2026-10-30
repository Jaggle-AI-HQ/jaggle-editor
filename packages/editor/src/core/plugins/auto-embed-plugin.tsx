"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  getDOMSelection,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  PASTE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import { MessageSquareQuote, SquarePlay, X } from "lucide-react";

import { Command, CommandItem, CommandList } from "../../ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../ui/popover";

import { useTranslation } from "../lib/locale";
import { $createTweetNode, tweetStatusId } from "../nodes/tweet-node";
import {
  $createYouTubeNode,
  parseYouTubeVideoId,
} from "../nodes/youtube-node";

import {
  getDOMRangeRect,
  hideFloatingAnchor,
  setFloatingAnchorRect,
  useFloatingCollisionBoundary,
} from "./floating/floating-utils";

type EmbedKind = "youtube" | "tweet";

type PendingEmbed = {
  kind: EmbedKind;
  id: string;
  url: string;
};

const STANDALONE_URL = /^https?:\/\/\S+$/i;

function parseEmbed(text: string): { kind: EmbedKind; id: string; url: string } | null {
  const url = text.trim();
  if (!STANDALONE_URL.test(url)) {
    return null;
  }
  const youtubeId = parseYouTubeVideoId(url);
  if (youtubeId) {
    return { kind: "youtube", id: youtubeId, url };
  }
  const tweetId = tweetStatusId(url);
  if (tweetId) {
    return { kind: "tweet", id: tweetId, url };
  }
  return null;
}

function positionEmbedAnchor(editor: LexicalEditor, anchor: HTMLElement) {
  const rootElement = editor.getRootElement();
  const nativeSelection = getDOMSelection(editor._window);
  if (rootElement === null || nativeSelection === null) {
    hideFloatingAnchor(anchor);
    return false;
  }
  const rect = getDOMRangeRect(nativeSelection, rootElement);
  if (rect.width === 0 && rect.height === 0 && rect.left === 0 && rect.top === 0) {
    const node = nativeSelection.anchorNode;
    const element =
      node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    if (element === null) {
      hideFloatingAnchor(anchor);
      return false;
    }
    setFloatingAnchorRect(anchor, element.getBoundingClientRect());
    return true;
  }
  setFloatingAnchorRect(anchor, rect);
  return true;
}

function $removePastedUrl(url: string): LexicalNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const node = selection.anchor.getNode();
  const link = $findMatchingParent(node, $isLinkNode);
  const top = (link ?? node).getTopLevelElement();

  if (link) {
    link.remove();
    return top;
  }

  if ($isTextNode(node)) {
    const offset = selection.anchor.offset;
    const text = node.getTextContent();
    if (text.slice(Math.max(0, offset - url.length), offset) === url) {
      node.spliceText(offset - url.length, url.length, "");
    } else {
      const index = text.lastIndexOf(url);
      if (index >= 0) {
        node.spliceText(index, url.length, "");
      }
    }
  }

  return top;
}

function $embedPending(pending: PendingEmbed) {
  const top = $removePastedUrl(pending.url);
  const embed =
    pending.kind === "youtube"
      ? $createYouTubeNode(pending.id)
      : $createTweetNode(pending.id);
  const paragraph = $createParagraphNode();
  if (top && $isParagraphNode(top) && top.getTextContent().trim() === "") {
    top.replace(embed);
  } else if (top && top.getParent()) {
    top.insertAfter(embed);
  } else {
    $getRoot().append(embed);
  }
  embed.insertAfter(paragraph);
  paragraph.selectEnd();
}

export function AutoEmbedPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t, dir } = useTranslation();
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingEmbed | null>(null);
  const [highlighted, setHighlighted] = useState("embed");

  useEffect(() => {
    const anchor = anchorRef.current;
    if (anchor) {
      hideFloatingAnchor(anchor);
    }
  }, []);

  const dismiss = useCallback(() => {
    setPending(null);
    const anchor = anchorRef.current;
    if (anchor) {
      hideFloatingAnchor(anchor);
    }
    editor.focus();
  }, [editor]);

  const embed = useCallback(() => {
    if (pending === null) {
      return;
    }
    const next = pending;
    setPending(null);
    editor.update(() => {
      $embedPending(next);
    });
    editor.focus();
  }, [editor, pending]);

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) {
          return false;
        }
        if ((event.clipboardData?.files.length ?? 0) > 0) {
          return false;
        }
        const match = parseEmbed(event.clipboardData?.getData("text/plain") ?? "");
        if (!match || !$isRangeSelection($getSelection())) {
          return false;
        }

        event.preventDefault();
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(match.url);
            }
          },
          {
            onUpdate: () => {
              requestAnimationFrame(() => {
                const anchor = anchorRef.current;
                if (anchor === null || !positionEmbedAnchor(editor, anchor)) {
                  return;
                }
                setHighlighted("embed");
                setPending(match);
              });
            },
          },
        );
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  useEffect(() => {
    if (pending === null) {
      return;
    }
    const reposition = () => {
      const anchor = anchorRef.current;
      if (anchor) {
        positionEmbedAnchor(editor, anchor);
      }
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [editor, pending]);

  useEffect(() => {
    if (pending === null) {
      return;
    }
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          dismiss();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          event.preventDefault();
          setHighlighted((current) =>
            current === "embed" ? "dismiss" : "embed",
          );
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          event.preventDefault();
          setHighlighted((current) =>
            current === "dismiss" ? "embed" : "dismiss",
          );
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          event?.preventDefault();
          if (highlighted === "dismiss") {
            dismiss();
          } else {
            embed();
          }
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [dismiss, editor, embed, highlighted, pending]);

  const embedLabel =
    pending?.kind === "youtube" ? t.embedYoutube : t.embedTweet;
  const EmbedIcon =
    pending?.kind === "youtube" ? SquarePlay : MessageSquareQuote;

  return (
    <Popover
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          dismiss();
        }
      }}
    >
      <PopoverAnchor
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 opacity-0"
      />
      {pending ? (
      <PopoverContent
        dir={dir}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        hideWhenDetached
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
        className="w-auto overflow-hidden p-0"
      >
        <Command value={highlighted} shouldFilter={false}>
          <CommandList className="w-56">
            <CommandItem
              value="dismiss"
              onSelect={dismiss}
            >
              <X className="text-muted-foreground" />
              <span className="truncate">{t.autoEmbedDismiss}</span>
            </CommandItem>
            <CommandItem
              value="embed"
              onSelect={embed}
            >
              <EmbedIcon className="text-muted-foreground" />
              <span className="truncate">{embedLabel}</span>
            </CommandItem>
          </CommandList>
        </Command>
      </PopoverContent>
      ) : null}
    </Popover>
  );
}
