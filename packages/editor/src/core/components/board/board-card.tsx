"use client";

import { useRef, useState } from "react";

import { useSortable } from "@dnd-kit/react/sortable";
import {
  Calendar03Icon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../ui/popover";
import { cn } from "../../../lib/utils";

import {
  BOARD_CLASSES,
  type BoardCard,
  formatBoardDate,
  isBoardDateOverdue,
} from "../../lib/board";
import { useTranslation } from "../../lib/locale";

import {
  BoardAssigneeAvatars,
  BoardAssigneePicker,
  BoardDueDatePicker,
} from "./board-card-properties";
import type { BoardActions } from "./board-surface";

export const BOARD_CARD_TYPE = "board-card";

type CardPanel = "assignees" | "dueDate";

/** Read-only card body, shared by the list and the drag overlay. */
export function BoardCardContent({
  card,
  untitled,
  overdueLabel,
  onOpenPanel,
}: {
  card: BoardCard;
  untitled: string;
  overdueLabel: string;
  onOpenPanel?: (panel: CardPanel) => void;
}) {
  const overdue = isBoardDateOverdue(card.dueDate);
  const hasMeta = card.dueDate !== null || card.assignees.length > 0;
  return (
    <>
      {card.title || (
        <span className="pointer-events-none text-muted-foreground">
          {untitled}
        </span>
      )}
      {hasMeta ? (
        <div className={BOARD_CLASSES.meta}>
          {card.dueDate ? (
            <button
              type="button"
              disabled={!onOpenPanel}
              title={overdue ? overdueLabel : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1 -mx-1 enabled:cursor-pointer enabled:hover:bg-accent",
                overdue && "text-red-600 dark:text-red-400",
              )}
              onClick={() => onOpenPanel?.("dueDate")}
            >
              <HugeiconsIcon icon={Calendar03Icon} size={14} aria-hidden="true" />
              {formatBoardDate(card.dueDate)}
            </button>
          ) : null}
          {card.assignees.length > 0 ? (
            <button
              type="button"
              disabled={!onOpenPanel}
              aria-label={card.assignees.map((person) => person.name).join(", ")}
              className="ms-auto rounded-full enabled:cursor-pointer"
              onClick={() => onOpenPanel?.("assignees")}
            >
              <BoardAssigneeAvatars assignees={card.assignees} />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function BoardCardView({
  card,
  index,
  columnId,
  isEditable,
  isEditing,
  actions,
}: {
  card: BoardCard;
  index: number;
  columnId: string;
  isEditable: boolean;
  isEditing: boolean;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const [panel, setPanel] = useState<CardPanel | null>(null);
  // A panel chosen from the menu opens only once the menu has closed. Opened
  // earlier, it can land under the pointer, and the closing menu pulls focus
  // back to itself, which dismisses the panel.
  const pendingPanelRef = useRef<CardPanel | null>(null);
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    group: columnId,
    type: BOARD_CARD_TYPE,
    accept: BOARD_CARD_TYPE,
    disabled: !isEditable || isEditing || panel !== null,
  });


  if (isEditing) {
    return (
      <div ref={ref} data-board-card-id={card.id}>
        <textarea
          autoFocus
          rows={1}
          defaultValue={card.title}
          placeholder={t.boardCardTitlePlaceholder}
          aria-label={t.boardCardTitlePlaceholder}
          className={cn(
            BOARD_CLASSES.card,
            "field-sizing-content block w-full resize-none select-text border-ring/50 outline-none",
          )}
          onFocus={(event) => {
            const length = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(length, length);
          }}
          onBlur={(event) => {
            const value = event.currentTarget.value.replace(/\s+/g, " ").trim();
            if (value !== card.title) {
              actions.renameCard(card.id, value);
            }
            actions.stopEdit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.currentTarget.value = card.title;
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-board-card-id={card.id}
      role={isEditable ? "button" : undefined}
      tabIndex={isEditable ? 0 : undefined}
      className={cn(
        BOARD_CLASSES.card,
        "group/board-card relative outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        isEditable && "cursor-pointer pe-8 hover:bg-accent/40",
        isDragging &&
          "border-dashed border-border bg-transparent hover:bg-transparent *:invisible",
      )}
      onClick={(event) => {
        if (isEditable && event.target === event.currentTarget) {
          actions.startEdit({ kind: "card", id: card.id });
        }
      }}
      onKeyDown={(event) => {
        if (
          isEditable &&
          event.key === "Enter" &&
          event.target === event.currentTarget
        ) {
          event.preventDefault();
          actions.startEdit({ kind: "card", id: card.id });
        }
      }}
    >
      <BoardCardContent
        card={card}
        untitled={t.boardUntitled}
        overdueLabel={t.boardOverdue}
        onOpenPanel={isEditable ? setPanel : undefined}
      />
      {isEditable ? (
        <>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.boardCardActions}
                className="absolute end-1 top-1 size-6 text-muted-foreground opacity-0 group-hover/board-card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44"
              onCloseAutoFocus={(event) => {
                const pending = pendingPanelRef.current;
                if (pending) {
                  pendingPanelRef.current = null;
                  event.preventDefault();
                  setPanel(pending);
                }
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  pendingPanelRef.current = "assignees";
                }}
              >
                <HugeiconsIcon icon={UserAdd01Icon} size={16} aria-hidden="true" />
                {t.boardAssign}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  pendingPanelRef.current = "dueDate";
                }}
              >
                <HugeiconsIcon icon={Calendar03Icon} size={16} aria-hidden="true" />
                {t.boardDueDate}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => actions.duplicateCard(card.id)}>
                <HugeiconsIcon icon={Copy01Icon} size={16} aria-hidden="true" />
                {t.boardDuplicate}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.deleteCard(card.id)}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} aria-hidden="true" />
                {t.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover
            open={panel !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPanel(null);
              }
            }}
          >
            <PopoverAnchor className="pointer-events-none absolute inset-x-0 bottom-0" />
            {panel ? (
              <PopoverContent
                align="start"
                aria-label={panel === "assignees" ? t.boardAssignees : t.boardDueDate}
                className="w-auto gap-0 overflow-hidden p-0"
              >
                {panel === "assignees" ? (
                  <BoardAssigneePicker
                    assignees={card.assignees}
                    onToggle={(person) =>
                      actions.toggleCardAssignee(card.id, person)
                    }
                  />
                ) : (
                  <BoardDueDatePicker
                    dueDate={card.dueDate}
                    onChange={(dueDate) => {
                      actions.setCardDueDate(card.id, dueDate);
                      setPanel(null);
                    }}
                  />
                )}
              </PopoverContent>
            ) : null}
          </Popover>
        </>
      ) : null}
    </div>
  );
}
