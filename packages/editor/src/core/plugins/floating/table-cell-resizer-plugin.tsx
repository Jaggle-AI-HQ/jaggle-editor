import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEventHandler } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $computeTableMapSkipCellCheck,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableCellNode,
  $isTableRowNode,
  getDOMCellFromTarget,
  getTableElement,
  type TableCellNode,
  type TableDOMCell,
  type TableMapType,
  TableNode,
} from "@lexical/table";
import { calculateZoomLevel } from "@lexical/utils";
import {
  $getNearestNodeFromDOMNode,
  isHTMLElement,
  type LexicalEditor,
  type NodeKey,
  registerEventListener,
  registerEventListeners,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from "lexical";
import { createPortal } from "react-dom";

import { cn } from "../../../lib/utils";

import { useTranslation } from "../../lib/locale";
import { MIN_COLUMN_WIDTH, measureColumnWidths } from "../../lib/table-widths";

import { getTableClipRect, isRectVisibleInClip } from "./floating-utils";

type PointerPosition = { x: number; y: number };
type ResizeDirection = "right" | "bottom";

const MIN_ROW_HEIGHT = 33;
const ZONE = 16;

function getCellColumnIndex(
  tableCellNode: TableCellNode,
  tableMap: TableMapType,
) {
  for (const row of tableMap) {
    for (let column = 0; column < row.length; column++) {
      if (row[column]?.cell === tableCellNode) {
        return column;
      }
    }
  }
  return undefined;
}

function TableCellResizer({ editor }: { editor: LexicalEditor }) {
  const { t } = useTranslation();
  const targetRef = useRef<Element | null>(null);
  const pointerStartPosRef = useRef<PointerPosition | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const [hasTable, setHasTable] = useState(false);
  const [pointerCurrentPos, setPointerCurrentPos] =
    useState<PointerPosition | null>(null);
  const [activeCell, setActiveCell] = useState<TableDOMCell | null>(null);
  const [tableRect, setTableRect] = useState<DOMRect | null>(null);
  const [draggingDirection, setDraggingDirection] =
    useState<ResizeDirection | null>(null);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  useEffect(() => {
    const tableKeys = new Set<NodeKey>();
    return editor.registerMutationListener(TableNode, (mutations) => {
      for (const [nodeKey, mutation] of mutations) {
        if (mutation === "destroyed") {
          tableKeys.delete(nodeKey);
        } else {
          tableKeys.add(nodeKey);
        }
      }
      setHasTable(tableKeys.size > 0);
    });
  }, [editor]);

  const resetState = useCallback(() => {
    setActiveCell(null);
    targetRef.current = null;
    setDraggingDirection(null);
    pointerStartPosRef.current = null;
    setTableRect(null);
    setPointerCurrentPos(null);
  }, []);

  useEffect(() => {
    if (!hasTable) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!isHTMLElement(target)) {
        return;
      }

      if (draggingDirection) {
        event.preventDefault();
        event.stopPropagation();
        setPointerCurrentPos({ x: event.clientX, y: event.clientY });
        return;
      }
      if (target.closest('[role="separator"]')) {
        return;
      }

      if (targetRef.current !== target) {
        targetRef.current = target;
        const cell = getDOMCellFromTarget(target);
        if (cell && activeCell !== cell) {
          editor.read("latest", () => {
            const tableCellNode = $getNearestNodeFromDOMNode(cell.elem);
            if (!tableCellNode) {
              return;
            }
            const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
            const tableElement = getTableElement(
              tableNode,
              editor.getElementByKey(tableNode.getKey()),
            );
            if (!tableElement) {
              return;
            }
            if (
              !isRectVisibleInClip(
                cell.elem.getBoundingClientRect(),
                getTableClipRect(tableElement),
              )
            ) {
              resetState();
              return;
            }
            setTableRect(getTableClipRect(tableElement));
            setActiveCell(cell);
          });
        } else if (cell == null) {
          resetState();
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        onPointerMove(event);
      }
    };

    return editor.registerRootListener((rootElement) => {
      if (rootElement) {
        return registerEventListeners(rootElement, {
          pointerdown: onPointerDown,
          pointermove: onPointerMove,
        });
      }
    });
  }, [activeCell, draggingDirection, editor, hasTable, resetState]);

  const updateRowHeight = useCallback(
    (heightChange: number) => {
      if (!activeCell) {
        return;
      }
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            return;
          }
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const baseRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
          const tableRows = tableNode.getChildren();
          const isFullRowMerge =
            tableCellNode.getColSpan() === tableNode.getColumnCount();
          const tableRowIndex = isFullRowMerge
            ? baseRowIndex
            : baseRowIndex + tableCellNode.getRowSpan() - 1;
          const tableRow = tableRows[tableRowIndex];
          if (!$isTableRowNode(tableRow)) {
            return;
          }
          let height = tableRow.getHeight();
          if (height === undefined) {
            const rowCells = tableRow.getChildren().filter($isTableCellNode);
            height = Math.min(
              ...rowCells.map(
                (cell) =>
                  editor.getElementByKey(cell.getKey())?.clientHeight ??
                  Infinity,
              ),
            );
          }
          if (!Number.isFinite(height)) {
            height = MIN_ROW_HEIGHT;
          }
          tableRow.setHeight(Math.max(height + heightChange, MIN_ROW_HEIGHT));
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    },
    [activeCell, editor],
  );

  const updateColumnWidth = useCallback(
    (widthChange: number) => {
      if (!activeCell) {
        return;
      }
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            return;
          }
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const [tableMap] = $computeTableMapSkipCellCheck(
            tableNode,
            null,
            null,
          );
          const columnIndex = getCellColumnIndex(tableCellNode, tableMap);
          if (columnIndex === undefined) {
            return;
          }
          const colWidths = measureColumnWidths(
            tableNode,
            editor,
            tableNode.getColumnCount(),
          );
          const width = colWidths[columnIndex];
          if (width === undefined) {
            return;
          }
          colWidths[columnIndex] = Math.max(
            width + widthChange,
            MIN_COLUMN_WIDTH,
          );
          tableNode.setColWidths(colWidths);
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    },
    [activeCell, editor],
  );

  const pointerUpHandler = useCallback(
    (direction: ResizeDirection) => (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!activeCell || !pointerStartPosRef.current) {
        resetState();
        resizeCleanupRef.current?.();
        resizeCleanupRef.current = null;
        return;
      }
      const { x, y } = pointerStartPosRef.current;
      const zoom = calculateZoomLevel(event.target as Element);
      if (direction === "bottom") {
        updateRowHeight((event.clientY - y) / zoom);
      } else {
        updateColumnWidth((event.clientX - x) / zoom);
      }
      resetState();
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    },
    [activeCell, resetState, updateColumnWidth, updateRowHeight],
  );

  const toggleResize = useCallback(
    (direction: ResizeDirection): PointerEventHandler =>
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!activeCell) {
          return;
        }
        pointerStartPosRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        setPointerCurrentPos(pointerStartPosRef.current);
        setDraggingDirection(direction);
        resizeCleanupRef.current?.();
        resizeCleanupRef.current = registerEventListener(
          activeCell.elem.ownerDocument,
          "pointerup",
          pointerUpHandler(direction),
        );
      },
    [activeCell, pointerUpHandler],
  );

  const getResizerStyles = useCallback(() => {
    if (!activeCell) {
      return { bottom: null, right: null };
    }

    const { height, width, top, left } = activeCell.elem.getBoundingClientRect();
    const zoom = calculateZoomLevel(activeCell.elem);
    const styles: Record<ResizeDirection, CSSProperties> = {
      bottom: {
        height: `${ZONE}px`,
        left: `${window.scrollX + left}px`,
        top: `${window.scrollY + top + height - ZONE / 2}px`,
        width: `${width}px`,
      },
      right: {
        height: `${height}px`,
        left: `${window.scrollX + left + width - ZONE / 2}px`,
        top: `${window.scrollY + top}px`,
        width: `${ZONE}px`,
      },
    };

    if (draggingDirection && pointerCurrentPos && tableRect) {
      if (draggingDirection === "bottom") {
        styles.bottom.left = `${window.scrollX + tableRect.left}px`;
        styles.bottom.top = `${window.scrollY + pointerCurrentPos.y / zoom}px`;
        styles.bottom.height = "2px";
        styles.bottom.width = `${tableRect.width}px`;
      } else {
        styles.right.top = `${window.scrollY + tableRect.top}px`;
        styles.right.left = `${window.scrollX + pointerCurrentPos.x / zoom}px`;
        styles.right.width = "2px";
        styles.right.height = `${tableRect.height}px`;
      }
    }

    return styles;
  }, [activeCell, draggingDirection, pointerCurrentPos, tableRect]);

  const resizerStyles = getResizerStyles();

  return (
    <div>
      {activeCell ? (
        <>
          <div
            role="separator"
            aria-label={t.resizeTableColumn}
            aria-orientation="vertical"
            className={cn(
              "fixed z-20 touch-none",
              draggingDirection === "right"
                ? "bg-primary"
                : "cursor-col-resize bg-transparent",
            )}
            style={resizerStyles.right ?? undefined}
            onPointerDown={toggleResize("right")}
          />
          <div
            role="separator"
            aria-label={t.resizeTableRow}
            aria-orientation="horizontal"
            className={cn(
              "fixed z-20 touch-none",
              draggingDirection === "bottom"
                ? "bg-primary"
                : "cursor-row-resize bg-transparent",
            )}
            style={resizerStyles.bottom ?? undefined}
            onPointerDown={toggleResize("bottom")}
          />
        </>
      ) : null}
    </div>
  );
}

export function TableCellResizerPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  if (!isEditable) {
    return null;
  }

  return createPortal(
    <TableCellResizer editor={editor} />,
    editor.getRootElement()?.ownerDocument.body ?? document.body,
  );
}
