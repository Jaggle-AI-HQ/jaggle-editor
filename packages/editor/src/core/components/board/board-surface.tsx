"use client";

import {
  type FocusEvent,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "../../../ui/button";
import { cn } from "../../../lib/utils";

import {
  addCard,
  addColumn,
  BOARD_CLASSES,
  BOARD_COLOR_CLASSES,
  type BoardAssignee,
  type BoardCard,
  type BoardColor,
  type BoardColumns,
  createBoardCard,
  createBoardColumn,
  deleteCard,
  deleteColumn,
  duplicateCard,
  moveCard,
  moveColumn,
  renameCard,
  renameColumn,
  setCardDueDate,
  setColumnColor,
  toggleCardAssignee,
} from "../../lib/board";
import {
  applyBoardDropSlot,
  type BoardDragRect,
  type BoardDropSlot,
  measureBoardDropGeometry,
  moveBoardDropSlotByKey,
  resolveBoardDropSlot,
} from "../../lib/board-drop-slot";
import { useTranslation } from "../../lib/locale";

import { BOARD_CARD_TYPE, BoardCardContent } from "./board-card";
import { BOARD_COLUMN_TYPE, BoardColumnView } from "./board-column";

export type BoardChange = {
  title?: string;
  columns?: (columns: BoardColumns) => BoardColumns;
};

export type BoardEditing = { kind: "card" | "column"; id: string } | null;

export type BoardActions = {
  startEdit: (next: BoardEditing) => void;
  stopEdit: () => void;
  addCard: (columnId: string) => void;
  renameCard: (cardId: string, value: string) => void;
  duplicateCard: (cardId: string) => void;
  deleteCard: (cardId: string) => void;
  toggleCardAssignee: (cardId: string, assignee: BoardAssignee) => void;
  setCardDueDate: (cardId: string, dueDate: string | null) => void;
  renameColumn: (columnId: string, value: string) => void;
  setColumnColor: (columnId: string, color: BoardColor) => void;
  deleteColumn: (columnId: string) => void;
};

type DragState = {
  /** The node columns this drag started from. A newer node value replaces the projection. */
  base: BoardColumns;
  order: string[];
  items: Record<string, string[]>;
};

const KEY_DIRECTIONS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Matches a card inside a 256 px column with 6 px padding. */
const CARD_OVERLAY_WIDTH = "w-[244px]";

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
        : [new PointerActivationConstraints.Distance({ value: 5 })],
  }),
  // Enter edits the focused card or renames the column; Space picks it up.
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ["Space"],
      cancel: ["Escape"],
      end: ["Space", "Enter", "Tab"],
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
    },
  }),
];

function toDragState(columns: BoardColumns): DragState {
  return {
    base: columns,
    order: columns.map((column) => column.id),
    items: Object.fromEntries(
      columns.map((column) => [
        column.id,
        column.cards.map((card) => card.id),
      ]),
    ),
  };
}

function projectDragState(drag: DragState): BoardColumns {
  const cards = new Map<string, BoardCard>();
  for (const column of drag.base) {
    for (const card of column.cards) {
      cards.set(card.id, card);
    }
  }
  return drag.order.flatMap((columnId) => {
    const column = drag.base.find((item) => item.id === columnId);
    if (!column) {
      return [];
    }
    return [
      {
        ...column,
        cards: (drag.items[columnId] ?? []).flatMap((cardId) => {
          const card = cards.get(cardId);
          return card ? [card] : [];
        }),
      },
    ];
  });
}

/**
 * The board itself: title, columns, cards, drag and drop. It has no Lexical
 * dependency, so read-only views render it too (with `isEditable` off).
 */
export function BoardSurface({
  title,
  columns,
  isEditable,
  onChange,
  frameRef,
  frameClassName,
  onFrameFocus,
}: {
  title: string;
  columns: BoardColumns;
  isEditable: boolean;
  onChange: (change: BoardChange) => void;
  frameRef?: Ref<HTMLDivElement>;
  frameClassName?: string;
  onFrameFocus?: (event: FocusEvent<HTMLDivElement>) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<BoardEditing>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const lastDragEndRef = useRef(0);
  // Card drags: the resolved insertion slot and the pointer frame waiting for rAF.
  const slotRef = useRef<BoardDropSlot | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{
    cardId: string;
    point: { x: number; y: number };
    dragRect: BoardDragRect | null;
  } | null>(null);

  const viewColumns = useMemo(
    () => (drag && drag.base === columns ? projectDragState(drag) : columns),
    [columns, drag],
  );

  const setDragState = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const updateColumns = useCallback(
    (update: (columns: BoardColumns) => BoardColumns) =>
      onChange({ columns: update }),
    [onChange],
  );

  const actions = useMemo<BoardActions>(
    () => ({
      startEdit: (next: BoardEditing) => {
        if (performance.now() - lastDragEndRef.current < 250) {
          return;
        }
        setEditing(next);
      },
      stopEdit: () => setEditing(null),
      addCard: (columnId: string) => {
        const card = createBoardCard();
        updateColumns((current) => addCard(current, columnId, card));
        setEditing({ kind: "card", id: card.id });
      },
      renameCard: (cardId: string, value: string) =>
        updateColumns((current) => renameCard(current, cardId, value)),
      duplicateCard: (cardId: string) =>
        updateColumns((current) => duplicateCard(current, cardId)),
      deleteCard: (cardId: string) =>
        updateColumns((current) => deleteCard(current, cardId)),
      toggleCardAssignee: (cardId: string, assignee: BoardAssignee) =>
        updateColumns((current) =>
          toggleCardAssignee(current, cardId, assignee),
        ),
      setCardDueDate: (cardId: string, dueDate: string | null) =>
        updateColumns((current) => setCardDueDate(current, cardId, dueDate)),
      renameColumn: (columnId: string, value: string) =>
        updateColumns((current) => renameColumn(current, columnId, value)),
      setColumnColor: (columnId: string, color: BoardColor) =>
        updateColumns((current) => setColumnColor(current, columnId, color)),
      deleteColumn: (columnId: string) =>
        updateColumns((current) => deleteColumn(current, columnId)),
    }),
    [updateColumns],
  );

  const applySlot = (cardId: string, slot: BoardDropSlot) => {
    slotRef.current = slot;
    const current = dragRef.current;
    if (!current) {
      return;
    }
    const items = applyBoardDropSlot(current.items, cardId, slot);
    if (items !== current.items) {
      setDragState({ ...current, items });
    }
  };

  const resolvePoint = (
    cardId: string,
    point: { x: number; y: number },
    dragRect: BoardDragRect | null,
  ) => {
    const current = dragRef.current;
    if (!current || !rowRef.current) {
      return;
    }
    const slot = resolveBoardDropSlot({
      columns: measureBoardDropGeometry(rowRef.current, current.items),
      point,
      draggedCardId: cardId,
      previousSlot: slotRef.current,
      dragRect,
    });
    if (slot) {
      applySlot(cardId, slot);
    }
  };

  const cancelPendingFrame = () => {
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    pendingPointRef.current = null;
  };

  // One geometry pass per frame, however many pointer events arrive.
  const schedulePoint = (
    cardId: string,
    point: { x: number; y: number },
    dragRect: BoardDragRect | null,
  ) => {
    pendingPointRef.current = { cardId, point, dragRect };
    if (frameRequestRef.current !== null) {
      return;
    }
    frameRequestRef.current = requestAnimationFrame(() => {
      frameRequestRef.current = null;
      const pending = pendingPointRef.current;
      pendingPointRef.current = null;
      if (pending) {
        resolvePoint(pending.cardId, pending.point, pending.dragRect);
      }
    });
  };

  useEffect(() => cancelPendingFrame, []);

  const findCard = (cardId: string) => {
    for (const column of viewColumns) {
      const card = column.cards.find((item) => item.id === cardId);
      if (card) {
        return card;
      }
    }
    return undefined;
  };

  const handleAddColumn = () => {
    const column = createBoardColumn();
    updateColumns((current) => addColumn(current, column));
    setEditing({ kind: "column", id: column.id });
  };

  const commitTitle = (value: string) => {
    if (value !== title) {
      onChange({ title: value });
    }
  };

  return (
    <div
      ref={frameRef}
      data-board-chrome=""
      // Dragging cards shouldn't select text; in read view the text is selectable.
      className={cn("relative", isEditable && "select-none", BOARD_CLASSES.root, frameClassName)}
      onKeyDown={(event) => event.stopPropagation()}
      onFocus={onFrameFocus}
    >
      {isEditable ? (
        <input
          key={title}
          defaultValue={title}
          placeholder={t.boardTitlePlaceholder}
          aria-label={t.boardTitlePlaceholder}
          className={cn(
            BOARD_CLASSES.title,
            "w-full select-text bg-transparent outline-none placeholder:text-muted-foreground/60",
          )}
          onBlur={(event) => commitTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.currentTarget.value = title;
              event.currentTarget.blur();
            }
          }}
        />
      ) : title ? (
        <p className={BOARD_CLASSES.title}>{title}</p>
      ) : null}

      <DragDropProvider
        sensors={sensors}
        onDragStart={(event) => {
          setEditing(null);
          const next = toDragState(columns);
          setDragState(next);
          slotRef.current = null;
          const { source } = event.operation;
          if (source?.type !== BOARD_CARD_TYPE) {
            return;
          }
          const cardId = String(source.id);
          for (const columnId of next.order) {
            const index = next.items[columnId].indexOf(cardId);
            if (index !== -1) {
              slotRef.current = { columnId, index };
            }
          }
        }}
        onDragOver={(event) => {
          // Card order belongs to the geometry resolver below. Stop dnd-kit's
          // target-driven sorter so the two never move the same card.
          if (event.operation.source?.type === BOARD_CARD_TYPE) {
            event.preventDefault();
          }
        }}
        onDragMove={(event) => {
          const { source } = event.operation;
          if (source?.type !== BOARD_CARD_TYPE) {
            return;
          }
          const cardId = String(source.id);
          const nativeEvent = event.nativeEvent;
          if (
            typeof KeyboardEvent !== "undefined" &&
            nativeEvent instanceof KeyboardEvent
          ) {
            const direction = KEY_DIRECTIONS[nativeEvent.key];
            const current = dragRef.current;
            if (direction && current && slotRef.current) {
              applySlot(
                cardId,
                moveBoardDropSlotByKey({
                  slot: slotRef.current,
                  direction,
                  columnOrder: current.order,
                  order: current.items,
                  draggedCardId: cardId,
                }),
              );
            }
            return;
          }
          const bounds = event.operation.shape?.current.boundingRectangle;
          schedulePoint(
            cardId,
            event.operation.position.current,
            bounds ? { top: bounds.top, bottom: bounds.bottom } : null,
          );
        }}
        onDragEnd={(event) => {
          lastDragEndRef.current = performance.now();
          cancelPendingFrame();
          const current = dragRef.current;
          const { source } = event.operation;
          if (!current || !source || event.canceled) {
            slotRef.current = null;
            setDragState(null);
            return;
          }
          const sourceId = String(source.id);

          if (source.type === BOARD_COLUMN_TYPE) {
            const order = move(current.order, event);
            setDragState({ ...current, order });
            updateColumns((latest) =>
              moveColumn(latest, sourceId, order.indexOf(sourceId)),
            );
            return;
          }

          if (
            !(
              typeof KeyboardEvent !== "undefined" &&
              event.nativeEvent instanceof KeyboardEvent
            )
          ) {
            // Settle on where the card was released, not the last frame.
            const bounds = event.operation.shape?.current.boundingRectangle;
            resolvePoint(
              sourceId,
              event.operation.position.current,
              bounds ? { top: bounds.top, bottom: bounds.bottom } : null,
            );
          }
          const slot = slotRef.current;
          slotRef.current = null;
          if (slot) {
            updateColumns((latest) =>
              moveCard(latest, sourceId, slot.columnId, slot.index),
            );
          }
        }}
      >
        <div ref={rowRef} data-board-chrome="" className={BOARD_CLASSES.row}>
          {viewColumns.map((column, index) => (
            <BoardColumnView
              key={column.id}
              column={column}
              index={index}
              isEditable={isEditable}
              editing={editing}
              actions={actions}
            />
          ))}
          {isEditable ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 font-normal text-muted-foreground"
              onClick={handleAddColumn}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} aria-hidden="true" />
              {t.boardAddColumn}
            </Button>
          ) : null}
        </div>
        <DragOverlay>
          {(source) => {
            const sourceId = String(source.id);
            if (source.type === BOARD_COLUMN_TYPE) {
              const column = viewColumns.find((item) => item.id === sourceId);
              if (!column) {
                return null;
              }
              const colors = BOARD_COLOR_CLASSES[column.color];
              return (
                <div
                  className={cn(
                    BOARD_CLASSES.column,
                    colors.column,
                    "pointer-events-none bg-background shadow-md ring-1 ring-border/60",
                  )}
                >
                  <div className={BOARD_CLASSES.header}>
                    <span className={cn(BOARD_CLASSES.pill, colors.pill)}>
                      {column.title || t.boardUntitled}
                    </span>
                    <span className={BOARD_CLASSES.count}>
                      {column.cards.length}
                    </span>
                  </div>
                  {column.cards.map((card) => (
                    <div key={card.id} className={BOARD_CLASSES.card}>
                      <BoardCardContent
                        card={card}
                        untitled={t.boardUntitled}
                        overdueLabel={t.boardOverdue}
                      />
                    </div>
                  ))}
                </div>
              );
            }
            const card = findCard(sourceId);
            if (!card) {
              return null;
            }
            return (
              <div
                className={cn(
                  BOARD_CLASSES.card,
                  CARD_OVERLAY_WIDTH,
                  "pointer-events-none shadow-md",
                )}
              >
                <BoardCardContent
                  card={card}
                  untitled={t.boardUntitled}
                  overdueLabel={t.boardOverdue}
                />
              </div>
            );
          }}
        </DragOverlay>
      </DragDropProvider>
    </div>
  );
}
