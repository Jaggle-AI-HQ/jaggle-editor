"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  getDOMTextNode,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import { createPortal } from "react-dom";

import { useEditorAdapters } from "../../adapters/context";
import { usePeopleSearch, personName } from "../../adapters/people";
import type { EditorPerson } from "../../adapters/types";
import { useDebounce } from "../../lib/use-debounce";

import { MentionMenu } from "../components/mention-menu";
import { useDocumentUi } from "../document/ui-context";
import type { MentionScope } from "../lib/types";
import { $createMentionNode } from "../nodes/mention-node";
import type { MentionResult } from "../utils/search-mentions";

const MENTION_QUERY = /(?:^|\s)@([^\s@]*)$/;
const EMPTY_ITEMS: MentionResult[] = [];

function $mentionMatch() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  if (!$isTextNode(node)) return null;
  const text = node.getTextContent().slice(0, selection.anchor.offset);
  const match = MENTION_QUERY.exec(text);
  if (!match) return null;
  const query = match[1] ?? "";
  return {
    query,
    signature: `${node.getKey()}:${selection.anchor.offset}:${query}`,
    trigger: {
      nodeKey: node.getKey(),
      offset: selection.anchor.offset - query.length - 1,
    },
  };
}

type MentionTrigger = { nodeKey: NodeKey; offset: number };
type MenuPosition = { top: number; left: number };

function caretPosition() {
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return null;
  const rect = domSelection.getRangeAt(0).getBoundingClientRect();
  if (rect.bottom === 0 && rect.left === 0) return null;
  return { top: rect.bottom + 4, left: rect.left };
}

/**
 * Below the `@` that started the query, read from the text node Lexical
 * rendered. The DOM selection can trail the editor state by a keystroke when
 * the update listener runs (visible in centered text), so it is the fallback.
 */
function triggerPosition(
  editor: LexicalEditor,
  trigger: MentionTrigger | null,
): MenuPosition | null {
  const element = trigger ? editor.getElementByKey(trigger.nodeKey) : null;
  const text = element ? getDOMTextNode(element) : null;
  if (!trigger || !text || trigger.offset < 0 || trigger.offset >= text.length) {
    return caretPosition();
  }
  const range = text.ownerDocument.createRange();
  range.setStart(text, trigger.offset);
  range.setEnd(text, trigger.offset + 1);
  const rect = range.getBoundingClientRect();
  if (rect.bottom === 0 && rect.left === 0) return caretPosition();
  return { top: rect.bottom + 4, left: rect.left };
}

/** `::highlight(jaggle-mention-query)` in theme.css styles the typed "@query". */
const QUERY_HIGHLIGHT = "jaggle-mention-query";

/**
 * Marks "@" plus the query with the CSS Custom Highlight API, which styles
 * the text without changing the document or its DOM. Editors share one
 * highlight; each adds and removes only its own range. Browsers without the
 * API show the plain text.
 */
function setQueryHighlight(
  editor: LexicalEditor,
  current: Range | null,
  trigger: MentionTrigger | null,
  length: number,
): Range | null {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") {
    return null;
  }
  const registry = CSS.highlights;
  const highlight = registry.get(QUERY_HIGHLIGHT) ?? new Highlight();
  if (current) highlight.delete(current);
  let next: Range | null = null;
  const element = trigger ? editor.getElementByKey(trigger.nodeKey) : null;
  const text = element ? getDOMTextNode(element) : null;
  if (trigger && text && trigger.offset >= 0 && trigger.offset + length <= text.length) {
    next = text.ownerDocument.createRange();
    next.setStart(text, trigger.offset);
    next.setEnd(text, trigger.offset + length);
    highlight.add(next);
  }
  if (highlight.size > 0) registry.set(QUERY_HIGHLIGHT, highlight);
  else registry.delete(QUERY_HIGHLIGHT);
  return next;
}

type QueryBox = { top: number; left: number; width: number; height: number };
type QueryOverlay = { host: HTMLElement; boxes: QueryBox[] };

/** Room around the "@query" box, so the tint does not hug the letters. */
const QUERY_PAD_X = 3;
const QUERY_PAD_Y = 1;

/**
 * Rounded, padded boxes behind the "@query" (one per line it spans). The
 * Highlight API can only color text, so the tint is drawn in the editor's
 * positioned container, which keeps it in place inside scrolled or
 * transformed containers such as the comment composer.
 */
function measureQueryOverlay(editor: LexicalEditor, range: Range | null): QueryOverlay | null {
  const host = editor.getRootElement()?.offsetParent;
  if (!range || !(host instanceof HTMLElement)) return null;
  const origin = host.getBoundingClientRect();
  const boxes = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0)
    .map((rect) => ({
      top: rect.top - origin.top - host.clientTop + host.scrollTop - QUERY_PAD_Y,
      left: rect.left - origin.left - host.clientLeft + host.scrollLeft - QUERY_PAD_X,
      width: rect.width + QUERY_PAD_X * 2,
      height: rect.height + QUERY_PAD_Y * 2,
    }));
  return boxes.length > 0 ? { host, boxes } : null;
}

function sameOverlay(a: QueryOverlay | null, b: QueryOverlay | null) {
  if (a === null || b === null) return a === b;
  return (
    a.host === b.host &&
    a.boxes.length === b.boxes.length &&
    a.boxes.every(
      (box, index) =>
        box.top === b.boxes[index].top &&
        box.left === b.boxes[index].left &&
        box.width === b.boxes[index].width &&
        box.height === b.boxes[index].height,
    )
  );
}

const MENTION_LIMIT = 20;

function memberMention(member: EditorPerson): MentionResult {
  return {
    entityType: "user",
    entityId: member.id,
    title: personName(member),
    avatarUrl: member.avatarUrl || undefined,
  };
}

function samePosition(a: MenuPosition | null, b: MenuPosition) {
  return a !== null && a.top === b.top && a.left === b.left;
}

type MentionPluginProps = {
  constrainToEditor?: boolean;
  /** Who can be mentioned; wins over the document's `mentionScope`. */
  scope?: MentionScope;
};

/**
 * "@" mentions of people, through the app's `people` adapter (off without
 * one). Who is listed comes from the editor's `mentionScope`, else the
 * workspace's active members (`workspaceId`). Searched as you type.
 */
export function MentionPlugin(props: MentionPluginProps) {
  const { people } = useEditorAdapters();
  return people ? <PeopleMentionPlugin {...props} /> : null;
}

function PeopleMentionPlugin({ constrainToEditor = false, scope: scopeProp }: MentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { mentionScope, workspaceId } = useDocumentUi();
  const scope =
    scopeProp ??
    mentionScope ??
    (workspaceId ? { type: "workspace" as const, id: workspaceId } : null);
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [overlay, setOverlay] = useState<QueryOverlay | null>(null);
  const searchTerm = useDebounce(query?.trim() ?? "", 200);
  const searching = query !== null;
  const members = usePeopleSearch(searching ? scope : null, searchTerm, MENTION_LIMIT);
  const isLoading =
    searching &&
    scope !== null &&
    (members.isPending || searchTerm !== query.trim());
  const memberItems = members.data;
  const items = useMemo(
    () =>
      query === null || isLoading || !memberItems
        ? EMPTY_ITEMS
        : memberItems.map(memberMention),
    [isLoading, memberItems, query],
  );
  // A new result list starts at its first row.
  const [selectionFor, setSelectionFor] = useState(items);
  if (selectionFor !== items) {
    setSelectionFor(items);
    setSelectedIndex(0);
  }
  const selectedRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<MentionTrigger | null>(null);
  const highlightRef = useRef<Range | null>(null);
  const dismissedAtRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    itemsRef.current = items;
    selectedIndexRef.current = selectedIndex;
  }, [items, selectedIndex]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const match = $mentionMatch();
        if (dismissedAtRef.current !== match?.signature) {
          dismissedAtRef.current = null;
        }
        const nextQuery =
          match?.signature === dismissedAtRef.current
            ? null
            : (match?.query ?? null);
        setQuery((current) => (current === nextQuery ? current : nextQuery));
        triggerRef.current = nextQuery === null ? null : (match?.trigger ?? null);
        // "@" plus the query; nothing once the menu is closed or dismissed.
        highlightRef.current = setQueryHighlight(
          editor,
          highlightRef.current,
          triggerRef.current,
          nextQuery === null ? 0 : nextQuery.length + 1,
        );
        const nextOverlay = measureQueryOverlay(editor, highlightRef.current);
        setOverlay((current) => (sameOverlay(current, nextOverlay) ? current : nextOverlay));
        if (nextQuery !== null) {
          const nextPosition = triggerPosition(editor, triggerRef.current);
          if (nextPosition) {
            setPosition((current) =>
              samePosition(current, nextPosition) ? current : nextPosition,
            );
          }
        }
      });
    });
  }, [editor]);

  useEffect(
    () => () => {
      highlightRef.current = setQueryHighlight(editor, highlightRef.current, null, 0);
    },
    [editor],
  );

  useEffect(() => {
    if (query === null) return;
    const updatePosition = () => {
      const nextPosition = triggerPosition(editor, triggerRef.current);
      if (nextPosition) {
        setPosition((current) =>
          samePosition(current, nextPosition) ? current : nextPosition,
        );
      }
      const nextOverlay = measureQueryOverlay(editor, highlightRef.current);
      setOverlay((current) => (sameOverlay(current, nextOverlay) ? current : nextOverlay));
    };
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [editor, query]);

  const selectItem = useCallback(
    (item: MentionResult) => {
      editor.focus(() => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const node = selection.anchor.getNode();
          if ($isTextNode(node) && selection.isCollapsed()) {
            const offset = selection.anchor.offset;
            const before = node.getTextContent().slice(0, offset);
            const atIndex = before.lastIndexOf("@");
            if (atIndex >= 0) {
              node.spliceText(atIndex, offset - atIndex, "", true);
            }
          }
          const nextSelection = $getSelection();
          if (!$isRangeSelection(nextSelection)) return;
          nextSelection.insertNodes([$createMentionNode(item)]);
          nextSelection.insertText(" ");
        });
      });
      setQuery(null);
    },
    [editor],
  );

  const getAnchor = useCallback(
    () => triggerPosition(editor, triggerRef.current),
    [editor],
  );

  const dismissMenu = useCallback(() => {
    editor.getEditorState().read(() => {
      dismissedAtRef.current = $mentionMatch()?.signature ?? null;
    });
    // Escape changes nothing in the editor, so no update clears it.
    highlightRef.current = setQueryHighlight(editor, highlightRef.current, null, 0);
    setOverlay(null);
    setQuery(null);
  }, [editor]);

  useEffect(() => {
    if (query === null) return;

    const move = (direction: 1 | -1) => {
      const length = itemsRef.current.length;
      if (length === 0) return false;
      setSelectedIndex((index) => (index + direction + length) % length);
      return true;
    };

    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!move(1)) return false;
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, query]);

  useEffect(() => {
    if (query === null) return;
    return editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        const length = itemsRef.current.length;
        if (length === 0) return false;
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + length) % length);
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, query]);

  useEffect(() => {
    if (query === null) return;
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const item = itemsRef.current[selectedIndexRef.current];
        if (!item) return false;
        event?.preventDefault();
        selectItem(item);
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, query, selectItem]);

  useEffect(() => {
    if (query === null) return;
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        event.preventDefault();
        dismissMenu();
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, query, dismissMenu]);

  if (query === null || !position) return null;

  return (
    <>
      {overlay
        ? createPortal(
            overlay.boxes.map((box, index) => (
              <span
                key={index}
                aria-hidden="true"
                data-mention-query=""
                className="pointer-events-none absolute rounded-[5px] bg-primary/12"
                style={box}
              />
            )),
            overlay.host,
          )
        : null}
      <MentionMenu
      items={items}
      isLoading={isLoading}
      selectedIndex={Math.min(selectedIndex, Math.max(items.length - 1, 0))}
      position={position}
      getAnchor={getAnchor}
      selectedRef={selectedRef}
      onHover={setSelectedIndex}
      onSelect={selectItem}
      onClose={dismissMenu}
      constrainToEditor={constrainToEditor}
    />
    </>
  );
}
