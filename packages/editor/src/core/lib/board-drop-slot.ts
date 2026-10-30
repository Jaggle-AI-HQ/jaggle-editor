/**
 * Card drop placement for the editor board, adapted from the task board's
 * `kanban-drop-slot.ts`. The board measures card boxes on each drag frame and
 * resolves one insertion slot from the floating card's center, instead of
 * letting dnd-kit's target-driven sorter reorder cards. That keeps the slot
 * stable when a tall card or a gap sits under the pointer.
 */

export type BoardDropSlot = {
  columnId: string;
  /** Index in the destination column with the dragged card removed. */
  index: number;
};

type CardBox = { cardId: string; top: number; bottom: number };

export type BoardDropColumnGeometry = {
  columnId: string;
  left: number;
  right: number;
  cardIds: string[];
  cards: CardBox[];
};

export type BoardDragRect = { top: number; bottom: number };

export type BoardCardOrder = Record<string, string[]>;

const clampSlot = (
  columnId: string,
  cardIds: string[],
  index: number,
): BoardDropSlot => ({
  columnId,
  index: Math.max(0, Math.min(index, cardIds.length)),
});

const verticalOverlap = (a: BoardDragRect, b: BoardDragRect) =>
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const containsY = (rect: BoardDragRect, y: number) =>
  y >= rect.top && y <= rect.bottom;

function cardWithGreatestOverlap(
  cards: CardBox[],
  dragRect: BoardDragRect,
): CardBox | undefined {
  let best: CardBox | undefined;
  let bestOverlap = 0;
  for (const card of cards) {
    const overlap = verticalOverlap(dragRect, card);
    if (overlap > bestOverlap) {
      best = card;
      bestOverlap = overlap;
    }
  }
  return best;
}

/**
 * Colliding with a card takes that card's index, the way dnd-kit `move()` does
 * for one list. Inside the same column the previous slot decides the side, so
 * the slot does not flip back and forth while the pointer rests on a card.
 */
function slotForCollidedCard(
  columnId: string,
  cardIds: string[],
  target: CardBox,
  hitY: number,
  previousSlot: BoardDropSlot | null,
): BoardDropSlot {
  const targetIndex = cardIds.indexOf(target.cardId);
  if (targetIndex < 0) {
    return clampSlot(columnId, cardIds, previousSlot?.index ?? 0);
  }
  if (previousSlot?.columnId === columnId) {
    return clampSlot(
      columnId,
      cardIds,
      previousSlot.index <= targetIndex ? targetIndex + 1 : targetIndex,
    );
  }
  const targetCenter = (target.top + target.bottom) / 2;
  return clampSlot(
    columnId,
    cardIds,
    hitY > targetCenter ? targetIndex + 1 : targetIndex,
  );
}

export function resolveBoardDropSlot({
  columns,
  point,
  draggedCardId,
  previousSlot,
  dragRect,
}: {
  columns: BoardDropColumnGeometry[];
  point: { x: number; y: number };
  draggedCardId: string;
  previousSlot: BoardDropSlot | null;
  dragRect: BoardDragRect | null;
}): BoardDropSlot | null {
  const column = columns.find(
    ({ left, right }) => point.x >= left && point.x <= right,
  );
  if (!column) {
    return null;
  }

  const cardIds = column.cardIds.filter((id) => id !== draggedCardId);
  const placeholder = column.cards.find((card) => card.cardId === draggedCardId);
  const cards = column.cards
    .filter((card) => card.cardId !== draggedCardId && cardIds.includes(card.cardId))
    .sort((a, b) => a.top - b.top);

  if (cards.length === 0) {
    return clampSlot(column.columnId, cardIds, 0);
  }

  // Prefer the floating card's center. The grab point resting on a neighbor
  // after a swap would otherwise flip the slot back on the next frame.
  const hitY = dragRect ? (dragRect.top + dragRect.bottom) / 2 : point.y;
  const hitOverPlaceholder = placeholder != null && containsY(placeholder, hitY);
  const cardUnderHit = cards.find((card) => containsY(card, hitY));
  const overlapTarget =
    !cardUnderHit && !hitOverPlaceholder && dragRect
      ? cardWithGreatestOverlap(cards, dragRect)
      : undefined;
  const collided = cardUnderHit ?? overlapTarget;

  if (collided) {
    return slotForCollidedCard(
      column.columnId,
      cardIds,
      collided,
      hitY,
      previousSlot,
    );
  }

  if (previousSlot?.columnId === column.columnId) {
    const lastCard = cards[cards.length - 1];
    if (hitY > lastCard.bottom) {
      return clampSlot(column.columnId, cardIds, cardIds.length);
    }
    if (hitY < cards[0].top) {
      return clampSlot(column.columnId, cardIds, 0);
    }
    return previousSlot;
  }

  const firstAfterHit = cards.find((card) => hitY < card.top);
  const rawIndex = firstAfterHit
    ? cardIds.indexOf(firstAfterHit.cardId)
    : cardIds.indexOf(cards[cards.length - 1].cardId) + 1;
  return clampSlot(
    column.columnId,
    cardIds,
    rawIndex < 0 ? cardIds.length : rawIndex,
  );
}

/** Arrow keys move the slot one card up or down, or to the neighboring column. */
export function moveBoardDropSlotByKey({
  slot,
  direction,
  columnOrder,
  order,
  draggedCardId,
}: {
  slot: BoardDropSlot;
  direction: "up" | "down" | "left" | "right";
  columnOrder: string[];
  order: BoardCardOrder;
  draggedCardId: string;
}): BoardDropSlot {
  let { columnId, index } = slot;
  if (direction === "left" || direction === "right") {
    const columnIndex = columnOrder.indexOf(columnId);
    columnId =
      columnOrder[columnIndex + (direction === "left" ? -1 : 1)] ?? columnId;
  } else {
    index += direction === "up" ? -1 : 1;
  }
  const cardIds = (order[columnId] ?? []).filter((id) => id !== draggedCardId);
  return clampSlot(columnId, cardIds, index);
}

export function applyBoardDropSlot(
  order: BoardCardOrder,
  cardId: string,
  slot: BoardDropSlot,
): BoardCardOrder {
  const owned = Object.values(order).some((ids) => ids.includes(cardId));
  if (!owned || !order[slot.columnId]) {
    return order;
  }
  const next: BoardCardOrder = {};
  for (const [columnId, ids] of Object.entries(order)) {
    next[columnId] = ids.filter((id) => id !== cardId);
  }
  const destination = next[slot.columnId];
  const index = Math.max(0, Math.min(slot.index, destination.length));
  destination.splice(index, 0, cardId);
  const changed = Object.keys(order).some(
    (columnId) =>
      order[columnId].length !== next[columnId].length ||
      order[columnId].some((id, i) => id !== next[columnId][i]),
  );
  return changed ? next : order;
}

function parseTranslateY(style: CSSStyleDeclaration): number {
  if (style.translate && style.translate !== "none") {
    const parts = style.translate.trim().split(/\s+/);
    if (parts.length >= 2) {
      return Number.parseFloat(parts[1]) || 0;
    }
  }
  const transform = style.transform;
  if (!transform || transform === "none") {
    return 0;
  }
  const matrix3d = /^matrix3d\((.+)\)$/.exec(transform);
  if (matrix3d) {
    return Number.parseFloat(matrix3d[1].split(",")[13]) || 0;
  }
  const matrix = /^matrix\((.+)\)$/.exec(transform);
  if (matrix) {
    return Number.parseFloat(matrix[1].split(",")[5]) || 0;
  }
  return 0;
}

/** Reads column and card boxes under `root`, ignoring the sort animation's offset. */
export function measureBoardDropGeometry(
  root: HTMLElement,
  order: BoardCardOrder,
): BoardDropColumnGeometry[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-board-column-id]"),
  ).flatMap((column) => {
    const columnId = column.dataset.boardColumnId;
    if (!columnId) {
      return [];
    }
    const rect = column.getBoundingClientRect();
    const cards = Array.from(
      column.querySelectorAll<HTMLElement>("[data-board-card-id]"),
    ).flatMap((card) => {
      const cardId = card.dataset.boardCardId;
      if (!cardId) {
        return [];
      }
      const cardRect = card.getBoundingClientRect();
      // The sortable transition paints a moved card at its old place for a
      // moment. Collision uses the layout box it is animating toward.
      const translateY = parseTranslateY(getComputedStyle(card));
      return [
        {
          cardId,
          top: cardRect.top - translateY,
          bottom: cardRect.bottom - translateY,
        },
      ];
    });
    return [
      {
        columnId,
        left: rect.left,
        right: rect.right,
        cardIds: order[columnId] ?? [],
        cards,
      },
    ];
  });
}
