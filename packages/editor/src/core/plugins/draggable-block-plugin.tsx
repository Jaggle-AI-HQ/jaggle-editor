import { useCallback, useEffect, useRef, useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import { calculateZoomLevel, IS_APPLE } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  type NodeKey,
} from "lexical";
import { GripVertical, Plus } from "lucide-react";
import { createPortal } from "react-dom";

import { DropdownMenu, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { cn } from "../../lib/utils";

import { BlockMenuContent } from "../components/block-menu";
import { $menuTarget } from "../lib/block-actions";
import { useTranslation } from "../lib/locale";
import { useUploadsChanged } from "../lib/upload-registry";

const DRAGGABLE_BLOCK_MENU_CLASSNAME = "draggable-block-menu";

type HandleMenu = {
  nodeKey: NodeKey;
  top: number;
  left: number;
};

/**
 * The block menu opened from the ⋮⋮ handle, the same as a media block's ⋯.
 * Anchored where the handle was clicked, since the handle follows the
 * pointer afterwards.
 */
function BlockHandleMenu({ menu, onClose }: { menu: HandleMenu; onClose: () => void }) {
  return createPortal(
    <DropdownMenu open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed size-px opacity-0"
          style={{ top: menu.top, left: menu.left }}
        />
      </DropdownMenuTrigger>
      <BlockMenuContent nodeKey={menu.nodeKey} align="start" />
    </DropdownMenu>,
    document.body,
  );
}

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

function $topLevelAnchorKey(): string | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  return selection.anchor.getNode().getTopLevelElement()?.getKey() ?? null;
}

function setMenuPosition(
  targetElem: HTMLElement,
  floatingElem: HTMLElement,
  anchorElem: HTMLElement,
) {
  const zoomLevel = calculateZoomLevel(anchorElem, true);
  const targetRect = targetElem.getBoundingClientRect();
  const targetView = targetElem.ownerDocument.defaultView;
  const targetStyle = targetView
    ? targetView.getComputedStyle(targetElem)
    : null;
  floatingElem.style.display = "flex";
  const floatingElemRect = floatingElem.getBoundingClientRect();
  const anchorElementRect = anchorElem.getBoundingClientRect();
  let targetCalculateHeight = targetStyle
    ? parseFloat(targetStyle.lineHeight)
    : Number.NaN;
  if (Number.isNaN(targetCalculateHeight)) {
    targetCalculateHeight = targetRect.bottom - targetRect.top;
  }
  const top =
    (targetRect.top +
      (targetCalculateHeight -
        (floatingElemRect.height || targetCalculateHeight)) /
        2 -
      anchorElementRect.top +
      anchorElem.scrollTop) /
    zoomLevel;
  floatingElem.style.opacity = "1";
  floatingElem.style.transform = `translate(4px, ${top}px)`;
}

export function DraggableBlockPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t, dir } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const draggableElementRef = useRef<HTMLElement | null>(null);
  const [anchorElem, setAnchorElem] = useState<HTMLElement | null>(null);
  const [handleMenu, setHandleMenu] = useState<HandleMenu | null>(null);
  // A block whose file is uploading has no handle; re-check as uploads change.
  useUploadsChanged();
  const [draggableElement, setDraggableElementState] =
    useState<HTMLElement | null>(null);
  const setDraggableElement = useCallback(
    (element: HTMLElement | null) => {
      if (draggableElementRef.current === element) {
        return;
      }
      draggableElementRef.current = element;
      setDraggableElementState(element);
      if (element && anchorElem && menuRef.current) {
        setMenuPosition(element, menuRef.current, anchorElem);
      }
    },
    [anchorElem],
  );

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      setAnchorElem(rootElement?.parentElement ?? null);
    });
  }, [editor]);

  useEffect(() => {
    let frame = 0;
    const unregister = editor.registerUpdateListener(
      ({ editorState, prevEditorState }) => {
        if (!anchorElem || !draggableElementRef.current) {
          return;
        }
        const nextKey = editorState.read($topLevelAnchorKey);
        const prevKey = prevEditorState.read($topLevelAnchorKey);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const current = draggableElementRef.current;
          const menu = menuRef.current;
          if (!current || !menu) {
            return;
          }
          const nextElem = nextKey ? editor.getElementByKey(nextKey) : null;
          const followCaret =
            !current.isConnected ||
            (nextKey !== prevKey && nextElem !== null && nextElem !== current);
          const target = followCaret ? nextElem : current;
          if (!target?.isConnected) {
            return;
          }
          if (followCaret) {
            const rect = target.getBoundingClientRect();
            setMenuPosition(target, menu, anchorElem);
            anchorElem.dispatchEvent(
              new MouseEvent("mousemove", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + Math.min(rect.height, 24) / 2,
                view: window,
              }),
            );
          }
          setMenuPosition(target, menu, anchorElem);
        });
      },
    );
    return () => {
      cancelAnimationFrame(frame);
      unregister();
    };
  }, [anchorElem, editor]);

  if (!anchorElem) {
    return null;
  }

  const handleHidden = draggableElement?.querySelector("[data-node-uploading]") != null;

  function insertSlashBlock(event: React.MouseEvent) {
    if (!draggableElement) {
      return;
    }
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement);
      if (!node) {
        return;
      }
      // Like Notion: an empty line takes the slash itself; otherwise a new
      // paragraph goes below the block (above with Alt or Ctrl) and opens the
      // slash menu there, leaving the hovered block as it was.
      if ($isParagraphNode(node) && node.isEmpty()) {
        node.selectEnd().insertText("/");
        return;
      }
      const paragraph = $createParagraphNode();
      const textNode = $createTextNode("/");
      paragraph.append(textNode);
      if (event.altKey || event.ctrlKey) {
        node.insertBefore(paragraph);
      } else {
        node.insertAfter(paragraph);
      }
      textNode.selectEnd();
    });
    editor.focus();
  }

  // A click (not a drag) on the grip opens the block menu for that block.
  function openHandleMenu(event: React.MouseEvent | React.KeyboardEvent) {
    if (!draggableElement) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    // A paragraph holding only an image, poll or equation gets that block's menu.
    const nodeKey = editor.read(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement);
      return node ? $menuTarget(node.getTopLevelElement() ?? node).getKey() : null;
    });
    if (nodeKey) {
      setHandleMenu({ nodeKey, top: rect.bottom + 4, left: rect.left });
    }
  }

  return (
    <>
      {handleMenu ? (
        <BlockHandleMenu menu={handleMenu} onClose={() => setHandleMenu(null)} />
      ) : null}
      <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      menuComponent={
        <div
          ref={menuRef}
          data-visible={draggableElement !== null}
          className={cn(
            DRAGGABLE_BLOCK_MENU_CLASSNAME,
            "absolute top-0 flex cursor-grab items-center rounded-md p-px text-muted-foreground/75 will-change-transform active:cursor-grabbing",
            dir === "rtl" ? "right-2" : "-left-4",
            handleHidden && "invisible",
          )}
        >
          <button
            type="button"
            title={`${t.addBlockBelow}\n${IS_APPLE ? "Option" : "Alt"}-${t.addBlockAbove}`}
            aria-label={t.blockHandleInsert}
            className="flex size-6 items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={insertSlashBlock}
          >
            <Plus className="size-5" />
          </button>
          <div
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-label={`${t.blockHandleDrag}, ${t.blockOptions}`}
            title={`${t.blockHandleDrag}\n${t.blockOptions}`}
            className="flex size-6 items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
            onClick={openHandleMenu}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openHandleMenu(event);
              }
            }}
          >
            <GripVertical className="size-5" />
          </div>
        </div>
      }
      targetLineComponent={
        <div
          ref={targetLineRef}
          className="pointer-events-none absolute top-0 left-0 h-1 rounded-full bg-foreground/75 opacity-0 will-change-transform"
        />
      }
      isOnMenu={isOnMenu}
      onElementChanged={setDraggableElement}
    />
    </>
  );
}
