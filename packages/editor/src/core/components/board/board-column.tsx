"use client";

import { useRef, useState } from "react";

import { useSortable } from "@dnd-kit/react/sortable";
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../ui/alert-dialog";
import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { cn } from "../../../lib/utils";

import {
  BOARD_CLASSES,
  BOARD_COLOR_CLASSES,
  BOARD_COLORS,
  type BoardColor,
  type BoardColumn,
} from "../../lib/board";
import { type Locale, useTranslation } from "../../lib/locale";

import { BoardCardView } from "./board-card";
import type { BoardActions, BoardEditing } from "./board-surface";

export const BOARD_COLUMN_TYPE = "board-column";

const COLOR_LABELS: Record<BoardColor, keyof Locale> = {
  default: "boardColorDefault",
  gray: "boardColorGray",
  blue: "boardColorBlue",
  green: "boardColorGreen",
  yellow: "boardColorYellow",
  red: "boardColorRed",
};

export function BoardColumnView({
  column,
  index,
  isEditable,
  editing,
  actions,
}: {
  column: BoardColumn;
  index: number;
  isEditable: boolean;
  editing: BoardEditing;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const handleRef = useRef<HTMLDivElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Rename from the menu starts once the menu has closed, so the closing menu
  // cannot pull focus back out of the title field.
  const renameAfterMenuRef = useRef(false);
  const isRenaming = editing?.kind === "column" && editing.id === column.id;
  const colors = BOARD_COLOR_CLASSES[column.color];

  const { ref, isDragging } = useSortable({
    id: column.id,
    index,
    type: BOARD_COLUMN_TYPE,
    // Card placement is resolved from board geometry, so columns only sort columns.
    accept: BOARD_COLUMN_TYPE,
    handle: handleRef,
    disabled: !isEditable || isRenaming,
  });

  const handleDelete = () => {
    if (column.cards.length > 0) {
      setConfirmDelete(true);
    } else {
      actions.deleteColumn(column.id);
    }
  };

  return (
    <div
      ref={ref}
      data-board-chrome=""
      data-board-column-id={column.id}
      className={cn(
        BOARD_CLASSES.column,
        colors.column,
        isDragging && "opacity-40",
      )}
    >
      <div
        ref={handleRef}
        tabIndex={isEditable ? 0 : undefined}
        aria-label={isEditable ? t.boardDragColumn : undefined}
        className={cn(
          BOARD_CLASSES.header,
          "group/column-header rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isEditable && "cursor-grab",
        )}
      >
        {isRenaming ? (
          <input
            autoFocus
            defaultValue={column.title}
            placeholder={t.boardColumnTitlePlaceholder}
            aria-label={t.boardColumnTitlePlaceholder}
            className="h-7 min-w-0 flex-1 select-text rounded-md border border-ring/50 bg-background px-1.5 font-medium outline-none"
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== column.title) {
                actions.renameColumn(column.id, value);
              }
              actions.stopEdit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.currentTarget.value = column.title;
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <>
            <button
              type="button"
              disabled={!isEditable}
              className={cn(
                BOARD_CLASSES.pill,
                colors.pill,
                "cursor-pointer disabled:cursor-default",
                !column.title && "text-muted-foreground",
              )}
              onClick={() =>
                actions.startEdit({ kind: "column", id: column.id })
              }
            >
              {column.title || t.boardUntitled}
            </button>
            <span className={BOARD_CLASSES.count}>{column.cards.length}</span>
          </>
        )}
        {isEditable ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.boardColumnActions}
                className={cn(
                  "ms-auto size-6 text-muted-foreground opacity-0 group-hover/column-header:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                  isRenaming && "hidden",
                )}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              onCloseAutoFocus={(event) => {
                if (renameAfterMenuRef.current) {
                  renameAfterMenuRef.current = false;
                  event.preventDefault();
                  actions.startEdit({ kind: "column", id: column.id });
                }
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  renameAfterMenuRef.current = true;
                }}
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={16} aria-hidden="true" />
                {t.boardRename}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span
                    aria-hidden="true"
                    className={cn("size-4 rounded-sm border", colors.pill)}
                  />
                  {t.boardColor}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={column.color}
                    onValueChange={(value) =>
                      actions.setColumnColor(column.id, value as BoardColor)
                    }
                  >
                    {BOARD_COLORS.map((color) => (
                      <DropdownMenuRadioItem key={color} value={color}>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-4 rounded-sm border",
                            BOARD_COLOR_CLASSES[color].pill,
                          )}
                        />
                        {t[COLOR_LABELS[color]]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                <HugeiconsIcon icon={Delete02Icon} size={16} aria-hidden="true" />
                {t.boardDeleteColumn}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {column.cards.map((card, cardIndex) => (
        <BoardCardView
          key={card.id}
          card={card}
          index={cardIndex}
          columnId={column.id}
          isEditable={isEditable}
          isEditing={editing?.kind === "card" && editing.id === card.id}
          actions={actions}
        />
      ))}

      {isEditable ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 justify-start px-1.5 font-normal text-muted-foreground hover:bg-foreground/5 has-[>svg]:px-1.5 dark:hover:bg-foreground/5"
          onClick={() => actions.addCard(column.id)}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={16} aria-hidden="true" />
          {t.boardNewCard}
        </Button>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.boardDeleteColumnTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.boardDeleteColumnDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive bg-none text-white hover:bg-destructive/90"
              onClick={() => actions.deleteColumn(column.id)}
            >
              {t.boardDeleteColumn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
