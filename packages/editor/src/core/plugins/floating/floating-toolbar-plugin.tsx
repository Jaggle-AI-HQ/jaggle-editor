import { useCallback, useEffect, useRef, useState } from "react";


import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  getDOMSelection,
  getDOMSelectionPoints,
  isDOMDocumentNode,
  isDOMShadowRoot,
  type LexicalEditor,
  registerEventListener,
  registerEventListeners,
  SELECTION_CHANGE_COMMAND,
} from "lexical";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../ui/popover";

import { $getSelectedNode } from "../../extensions/format-state";
import { useTranslation } from "../../lib/locale";
import { AlignmentMenu } from "../toolbar/element-format-toolbar-plugin";
import {
  MoreTextFormatMenu,
  TextFormatToolbarPlugin,
} from "../toolbar/text-format-toolbar-plugin";

import {
  getDOMRangeRect,
  hideFloatingAnchor,
  setFloatingAnchorRect,
  useFloatingCollisionBoundary,
  getEditorVisibleArea,
} from "./floating-utils";

/** Space between the toolbar and the selection, and below the sticky header. */
const TOOLBAR_GAP = 8;

function FloatingToolbar({
  editor,
  children,
  ref,
  keepOpen,
  isMoreOpen,
  isPointerInside,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
  onFocusCapture,
  onBlurCapture,
}: {
  editor: LexicalEditor;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement | null>;
  keepOpen: boolean;
  isMoreOpen: boolean;
  isPointerInside: boolean;
  onDismiss: () => void;
  onPointerEnter: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>;
  onFocusCapture: React.FocusEventHandler<HTMLDivElement>;
  onBlurCapture: React.FocusEventHandler<HTMLDivElement>;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const pointerDownInsideRef = useRef(false);
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const { t, dir } = useTranslation();

  const setPopupRefs = useCallback(
    (elem: HTMLDivElement | null) => {
      popupRef.current = elem;
      if (typeof ref === "function") {
        ref(elem);
      } else if (ref) {
        ref.current = elem;
      }
    },
    [ref],
  );

  useEffect(() => {
    function mouseMoveListener(e: MouseEvent) {
      const popupElem = popupRef.current;
      if (popupElem && (e.buttons === 1 || e.buttons === 3)) {
        if (popupElem.style.pointerEvents !== "none") {
          const popupRoot = popupElem.getRootNode();
          const elementUnderMouse =
            isDOMDocumentNode(popupRoot) || isDOMShadowRoot(popupRoot)
              ? popupRoot.elementFromPoint(e.clientX, e.clientY)
              : null;
          if (!popupElem.contains(elementUnderMouse)) {
            popupElem.style.pointerEvents = "none";
          }
        }
      }
    }
    function mouseUpListener() {
      const popupElem = popupRef.current;
      if (popupElem && popupElem.style.pointerEvents !== "auto") {
        popupElem.style.pointerEvents = "auto";
      }
    }
    return registerEventListeners(document, {
      mousemove: mouseMoveListener,
      mouseup: mouseUpListener,
    });
  }, []);

  // Popover dismisses on a pointerdown that reaches the document, which never
  // happens inside a container that stops it (the task dialog does, so its
  // opener doesn't react). So outside presses are caught in the capture
  // phase too. Presses in the toolbar or its menus (its React tree, portals
  // included) and in the editor keep it.
  useEffect(() => {
    const onPointerDownCapture = (event: PointerEvent) => {
      pointerDownInsideRef.current = false;
      const target = event.target;
      // React's capture handlers run after this one; decide once they have.
      setTimeout(() => {
        if (pointerDownInsideRef.current) return;
        const root = editor.getRootElement();
        if (target instanceof Node && root?.contains(target)) return;
        if (target instanceof Element && target.closest("[data-floating-format-menu]")) {
          return;
        }
        onDismiss();
      }, 0);
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [editor, onDismiss]);

  const $updateAnchorPosition = useCallback(() => {
    const triggerElem = triggerRef.current;
    if (triggerElem === null) {
      return;
    }

    const selection = $getSelection();
    const nativeSelection = getDOMSelection(editor._window);
    const rootElement = editor.getRootElement();
    let targetRect: DOMRect | null = null;

    if (
      $isRangeSelection(selection) &&
      nativeSelection !== null &&
      rootElement !== null
    ) {
      const points = getDOMSelectionPoints(nativeSelection, rootElement);
      const pointsCollapsed =
        points.anchorNode === points.focusNode &&
        points.anchorOffset === points.focusOffset;
      if (!pointsCollapsed && rootElement.contains(points.anchorNode)) {
        targetRect = getDOMRangeRect(nativeSelection, rootElement);
      }
    }

    if (targetRect !== null && rootElement !== null) {
      // The toolbar sits above the selection's top edge. Once that edge is
      // scrolled out of the editor's visible area (under the sticky header or
      // past the scroll container), hide it instead of letting it float over
      // the page chrome.
      const area = getEditorVisibleArea(rootElement);
      if (targetRect.top < area.top || targetRect.top > area.bottom) {
        hideFloatingAnchor(triggerElem);
        return;
      }
      // Without room above the selection inside that area, pin the toolbar
      // just under the header, over the selection's first line (as Notion
      // does), instead of over the header.
      const space = (popupRef.current?.offsetHeight ?? 40) + TOOLBAR_GAP * 2;
      const anchorRect =
        targetRect.top - space < area.top
          ? new DOMRect(
              targetRect.left,
              area.top + space,
              targetRect.width,
              Math.max(0, targetRect.bottom - (area.top + space)),
            )
          : targetRect;
      setFloatingAnchorRect(triggerElem, anchorRect);
    } else if (!keepOpen) {
      hideFloatingAnchor(triggerElem);
    }
  }, [editor, keepOpen]);

  useEffect(() => {
    const update = () => {
      editor.read("latest", () => {
        $updateAnchorPosition();
      });
    };

    return mergeRegister(
      registerEventListener(window, "resize", update),
      registerEventListener(document, "scroll", update, true),
      registerEventListener(document, "selectionchange", update),
    );
  }, [editor, $updateAnchorPosition]);

  useEffect(() => {
    editor.read("latest", () => {
      $updateAnchorPosition();
    });
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateAnchorPosition();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateAnchorPosition();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, $updateAnchorPosition]);

  return (
    <Popover open onOpenChange={(open) => !open && onDismiss()}>
      <PopoverAnchor
        ref={triggerRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 opacity-0"
        style={{ transform: "translate(-10000px, -10000px)" }}
      />
      <PopoverContent
        dir={dir}
        ref={setPopupRefs}
        side="top"
        align="start"
        sideOffset={TOOLBAR_GAP}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        hideWhenDetached
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const root = editor.getRootElement();
          const isFocusOutside = event.detail.originalEvent.type === "focusin";
          const isInsideEditor =
            root !== null &&
            event.target instanceof Node &&
            root.contains(event.target);
          // Clicks in the editor never dismiss: the selection decides whether
          // the toolbar shows (a triple click keeps text selected).
          if (!isFocusOutside && isInsideEditor) {
            event.preventDefault();
            return;
          }
          if (
            (isFocusOutside &&
              (isMoreOpen ||
                (isPointerInside &&
                  root &&
                  event.target instanceof Node &&
                  root.contains(event.target)))) ||
            (event.target instanceof Element &&
              event.target.closest("[data-floating-format-menu]"))
          ) {
            event.preventDefault();
          }
        }}
        onPointerDownCapture={() => {
          pointerDownInsideRef.current = true;
        }}
        role="toolbar"
        aria-label={t.textFormatToolbar}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        className="flex w-max max-w-(--radix-popover-content-available-width) min-w-0 flex-wrap items-center gap-1.5 p-1"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function useIsTextSelected(editor: LexicalEditor): boolean {
  const [isText, setIsText] = useState(false);

  const updatePopup = useCallback(() => {
    editor.read("latest", () => {
      if (editor.isComposing()) {
        return;
      }
      const selection = $getSelection();
      const nativeSelection = getDOMSelection(editor._window);
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(
            getDOMSelectionPoints(nativeSelection, rootElement).anchorNode,
          ))
      ) {
        setIsText(false);
        return;
      }

      if (!$isRangeSelection(selection)) {
        setIsText(false);
        return;
      }

      const rawTextContent = selection.getTextContent().replace(/\n/g, "");
      if (selection.isCollapsed() || rawTextContent === "") {
        setIsText(false);
        return;
      }

      const node = $getSelectedNode(selection);
      setIsText($isTextNode(node) || $isParagraphNode(node));
    });
  }, [editor]);

  useEffect(() => {
    return registerEventListener(document, "selectionchange", updatePopup);
  }, [updatePopup]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updatePopup();
      }),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) {
          setIsText(false);
        }
      }),
    );
  }, [editor, updatePopup]);

  return isText;
}

export function FloatingToolbarPlugin({
  formats = "all",
  children,
}: {
  formats?: "basic" | "all";
  children?: React.ReactNode;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const isText = useIsTextSelected(editor);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [hasToolbarFocus, setHasToolbarFocus] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isAlignOpen, setIsAlignOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  // Keep the outside click that dismisses the toolbar from also reopening it
  // on the editor's pointerup.
  const isDismissedRef = useRef(false);
  const resumeOnPointerUpRef = useRef(false);
  const resumeOnKeyUpRef = useRef(false);
  const keepOpen = isPointerInside || hasToolbarFocus || isMoreOpen || isAlignOpen;

  const dismissToolbar = useCallback(() => {
    isDismissedRef.current = true;
    resumeOnPointerUpRef.current = false;
    resumeOnKeyUpRef.current = false;
    setIsDismissed(true);
    setIsPointerInside(false);
    setHasToolbarFocus(false);
    setIsMoreOpen(false);
    setIsAlignOpen(false);
  }, []);

  useEffect(() => {
    const onPointerDown = () => {
      resumeOnPointerUpRef.current = isDismissedRef.current;
    };
    const onPointerUp = () => {
      if (!resumeOnPointerUpRef.current) return;
      resumeOnPointerUpRef.current = false;
      isDismissedRef.current = false;
      setIsDismissed(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const selectionKey =
        event.key.startsWith("Arrow") ||
        event.key === "Home" ||
        event.key === "End" ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a");
      resumeOnKeyUpRef.current = isDismissedRef.current && selectionKey;
    };
    const onKeyUp = () => {
      if (!resumeOnKeyUpRef.current) return;
      resumeOnKeyUpRef.current = false;
      isDismissedRef.current = false;
      setIsDismissed(false);
    };
    let currentRoot: HTMLElement | null = null;
    const unregister = editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener("pointerdown", onPointerDown);
      previousRoot?.removeEventListener("pointerup", onPointerUp);
      previousRoot?.removeEventListener("keydown", onKeyDown);
      previousRoot?.removeEventListener("keyup", onKeyUp);
      root?.addEventListener("pointerdown", onPointerDown);
      root?.addEventListener("pointerup", onPointerUp);
      root?.addEventListener("keydown", onKeyDown);
      root?.addEventListener("keyup", onKeyUp);
      currentRoot = root;
    });
    return () => {
      unregister();
      currentRoot?.removeEventListener("pointerdown", onPointerDown);
      currentRoot?.removeEventListener("pointerup", onPointerUp);
      currentRoot?.removeEventListener("keydown", onKeyDown);
      currentRoot?.removeEventListener("keyup", onKeyUp);
    };
  }, [editor]);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDragStart = () => {
      if (toolbarRef.current) {
        toolbarRef.current.style.display = "none";
      }
    };
    const onDragEnd = () => {
      if (toolbarRef.current && toolbarRef.current.style.display === "none") {
        toolbarRef.current.style.display = "";
      }
    };
    return registerEventListeners(
      document,
      { dragend: onDragEnd, dragstart: onDragStart, drop: onDragEnd },
      true,
    );
  }, []);

  if (!isEditable || isDismissed || (!isText && !keepOpen)) {
    return null;
  }

  return (
    <FloatingToolbar
      editor={editor}
      ref={toolbarRef}
      keepOpen={keepOpen}
      isMoreOpen={isMoreOpen || isAlignOpen}
      isPointerInside={isPointerInside}
      onDismiss={dismissToolbar}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerLeave={() => setIsPointerInside(false)}
      onFocusCapture={() => setHasToolbarFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setHasToolbarFocus(false);
        }
      }}
    >
      <TextFormatToolbarPlugin formats="basic" />
      <span role="separator" aria-orientation="vertical" className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      {children}
      {formats === "all" ? <AlignmentMenu onOpenChange={setIsAlignOpen} /> : null}
      {formats === "all" ? (
        <MoreTextFormatMenu
          onOpenChange={setIsMoreOpen}
          onDismiss={dismissToolbar}
        />
      ) : null}
    </FloatingToolbar>
  );
}
