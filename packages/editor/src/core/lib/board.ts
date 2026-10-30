export const BOARD_COLORS = [
  "default",
  "gray",
  "blue",
  "green",
  "yellow",
  "red",
] as const;

export type BoardColor = (typeof BOARD_COLORS)[number];

/** A snapshot of the person, so export and read-only views need no lookup. */
export type BoardAssignee = Readonly<{
  id: string;
  name: string;
  avatarUrl?: string;
}>;

export type BoardCard = Readonly<{
  id: string;
  title: string;
  assignees: readonly BoardAssignee[];
  /** Local calendar date as `YYYY-MM-DD`, or null when unset. */
  dueDate: string | null;
}>;

export type BoardColumn = Readonly<{
  id: string;
  title: string;
  color: BoardColor;
  cards: readonly BoardCard[];
}>;

export type BoardColumns = readonly BoardColumn[];

/** Layout classes shared by the editor view and the static HTML export. */
export const BOARD_CLASSES = {
  root: "my-3",
  title: "mb-2 px-1 text-base font-semibold",
  row: "flex items-start gap-2 overflow-x-auto pb-2",
  column: "flex w-64 shrink-0 flex-col gap-1 rounded-lg p-1.5",
  header: "flex min-h-8 items-center gap-1.5 px-1",
  pill: "min-w-0 truncate rounded-md px-1.5 py-px font-medium",
  count: "text-muted-foreground/70",
  card: "rounded-md border border-border/60 bg-background px-2.5 py-2 whitespace-pre-wrap break-words",
  meta: "mt-1.5 flex flex-wrap items-center gap-1.5 text-muted-foreground",
} as const;

/** Column surface and title pill classes. Shared by the editor view and HTML export. */
export const BOARD_COLOR_CLASSES: Record<
  BoardColor,
  { column: string; pill: string }
> = {
  default: {
    column: "bg-muted/40",
    pill: "bg-muted text-foreground",
  },
  gray: {
    column: "bg-gray-50 dark:bg-gray-500/5",
    pill: "bg-gray-200/70 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
  },
  blue: {
    column: "bg-blue-50/50 dark:bg-blue-500/5",
    pill: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  green: {
    column: "bg-green-50/50 dark:bg-green-500/5",
    pill: "bg-green-100/80 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  },
  yellow: {
    column: "bg-yellow-50/50 dark:bg-yellow-500/5",
    pill: "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
  },
  red: {
    column: "bg-red-50/50 dark:bg-red-500/5",
    pill: "bg-red-100/80 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  },
};

function createBoardId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBoardCard(title = ""): BoardCard {
  return { id: createBoardId("card"), title, assignees: [], dueDate: null };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads a stored `YYYY-MM-DD` as a local date. */
export function parseBoardDate(value: string | null): Date | null {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toBoardDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** "Oct 14", or "Oct 14, 2027" outside the current year. */
export function formatBoardDate(value: string | null, now = new Date()): string {
  const date = parseBoardDate(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

export function isBoardDateOverdue(value: string | null, now = new Date()): boolean {
  const date = parseBoardDate(value);
  if (!date) {
    return false;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date < today;
}

export function boardInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function createBoardColumn(
  title = "",
  color: BoardColor = "default",
): BoardColumn {
  return { id: createBoardId("col"), title, color, cards: [] };
}

export function createDefaultBoardColumns(): BoardColumns {
  return [
    createBoardColumn("To do", "gray"),
    createBoardColumn("In progress", "blue"),
    createBoardColumn("Done", "green"),
  ];
}

function isBoardColor(value: unknown): value is BoardColor {
  return (
    typeof value === "string" &&
    (BOARD_COLORS as readonly string[]).includes(value)
  );
}

function parseAssignees(json: unknown): BoardAssignee[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const seen = new Set<string>();
  const assignees: BoardAssignee[] = [];
  for (const row of json) {
    if (
      row &&
      typeof row.id === "string" &&
      typeof row.name === "string" &&
      !seen.has(row.id)
    ) {
      seen.add(row.id);
      assignees.push(
        typeof row.avatarUrl === "string" && row.avatarUrl
          ? { id: row.id, name: row.name, avatarUrl: row.avatarUrl }
          : { id: row.id, name: row.name },
      );
    }
  }
  return assignees;
}

/** Reads untrusted JSON (node state, pasted HTML) into board columns, dropping anything malformed. */
export function parseBoardColumns(json: unknown): BoardColumns {
  if (!Array.isArray(json)) {
    return [];
  }
  const seen = new Set<string>();
  const columns: BoardColumn[] = [];
  for (const row of json) {
    if (
      !row ||
      typeof row.id !== "string" ||
      typeof row.title !== "string" ||
      seen.has(row.id)
    ) {
      continue;
    }
    seen.add(row.id);
    const cards: BoardCard[] = [];
    if (Array.isArray(row.cards)) {
      for (const card of row.cards) {
        if (
          card &&
          typeof card.id === "string" &&
          typeof card.title === "string" &&
          !seen.has(card.id)
        ) {
          seen.add(card.id);
          cards.push({
            id: card.id,
            title: card.title,
            assignees: parseAssignees(card.assignees),
            dueDate:
              typeof card.dueDate === "string" && parseBoardDate(card.dueDate)
                ? card.dueDate
                : null,
          });
        }
      }
    }
    columns.push({
      id: row.id,
      title: row.title,
      color: isBoardColor(row.color) ? row.color : "default",
      cards,
    });
  }
  return columns;
}

function updateColumn(
  columns: BoardColumns,
  columnId: string,
  update: (column: BoardColumn) => BoardColumn,
): BoardColumns {
  return columns.map((column) =>
    column.id === columnId ? update(column) : column,
  );
}

export function addColumn(
  columns: BoardColumns,
  column: BoardColumn,
): BoardColumns {
  return [...columns, column];
}

export function deleteColumn(
  columns: BoardColumns,
  columnId: string,
): BoardColumns {
  return columns.filter((column) => column.id !== columnId);
}

export function renameColumn(
  columns: BoardColumns,
  columnId: string,
  title: string,
): BoardColumns {
  return updateColumn(columns, columnId, (column) => ({ ...column, title }));
}

export function setColumnColor(
  columns: BoardColumns,
  columnId: string,
  color: BoardColor,
): BoardColumns {
  return updateColumn(columns, columnId, (column) => ({ ...column, color }));
}

export function addCard(
  columns: BoardColumns,
  columnId: string,
  card: BoardCard,
): BoardColumns {
  return updateColumn(columns, columnId, (column) => ({
    ...column,
    cards: [...column.cards, card],
  }));
}

function updateCard(
  columns: BoardColumns,
  cardId: string,
  update: (card: BoardCard) => BoardCard,
): BoardColumns {
  return columns.map((column) =>
    column.cards.some((card) => card.id === cardId)
      ? {
          ...column,
          cards: column.cards.map((card) =>
            card.id === cardId ? update(card) : card,
          ),
        }
      : column,
  );
}

export function renameCard(
  columns: BoardColumns,
  cardId: string,
  title: string,
): BoardColumns {
  return updateCard(columns, cardId, (card) => ({ ...card, title }));
}

/** Adds the person, or removes them when already assigned. */
export function toggleCardAssignee(
  columns: BoardColumns,
  cardId: string,
  assignee: BoardAssignee,
): BoardColumns {
  return updateCard(columns, cardId, (card) => ({
    ...card,
    assignees: card.assignees.some((item) => item.id === assignee.id)
      ? card.assignees.filter((item) => item.id !== assignee.id)
      : [...card.assignees, assignee],
  }));
}

export function setCardDueDate(
  columns: BoardColumns,
  cardId: string,
  dueDate: string | null,
): BoardColumns {
  return updateCard(columns, cardId, (card) => ({ ...card, dueDate }));
}

export function deleteCard(
  columns: BoardColumns,
  cardId: string,
): BoardColumns {
  return columns.map((column) =>
    column.cards.some((card) => card.id === cardId)
      ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
      : column,
  );
}

/** Inserts a copy of the card right after the original. */
export function duplicateCard(
  columns: BoardColumns,
  cardId: string,
): BoardColumns {
  return columns.map((column) => {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index === -1) {
      return column;
    }
    const cards = [...column.cards];
    cards.splice(index + 1, 0, {
      ...column.cards[index],
      id: createBoardCard().id,
    });
    return { ...column, cards };
  });
}

/** Moves a card to `toIndex` in `toColumnId`. Unknown ids leave the board unchanged. */
export function moveCard(
  columns: BoardColumns,
  cardId: string,
  toColumnId: string,
  toIndex: number,
): BoardColumns {
  let moving: BoardCard | undefined;
  for (const column of columns) {
    moving ??= column.cards.find((card) => card.id === cardId);
  }
  if (!moving || !columns.some((column) => column.id === toColumnId)) {
    return columns;
  }
  const card = moving;
  return columns.map((column) => {
    const cards = column.cards.filter((item) => item.id !== cardId);
    if (column.id !== toColumnId) {
      return cards.length === column.cards.length
        ? column
        : { ...column, cards };
    }
    const index = Math.max(0, Math.min(toIndex, cards.length));
    cards.splice(index, 0, card);
    return { ...column, cards };
  });
}

export function moveColumn(
  columns: BoardColumns,
  columnId: string,
  toIndex: number,
): BoardColumns {
  const from = columns.findIndex((column) => column.id === columnId);
  if (from === -1) {
    return columns;
  }
  const next = [...columns];
  const [column] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, column);
  return next;
}

export function boardTextContent(title: string, columns: BoardColumns): string {
  return [
    title,
    ...columns.flatMap((column) => [
      column.title,
      ...column.cards.map((card) => card.title),
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}
