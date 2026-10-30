import { useCallback, useEffect, useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $patchStyleText } from "@lexical/selection";
import {
  $findTableNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  $isTableSelection,
  $mergeCells,
  $setTableColumnIsHeader,
  $setTableRowIsHeader,
  $unmergeCellNode,
  TableCellHeaderStates,
  type TableCellNode,
  type TableNode,
} from "@lexical/table";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  type LexicalNode,
  type NodeKey,
  registerEventListener,
} from "lexical";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";

import { useTranslation } from "../../lib/locale";

import { getTableClipRect, isRectVisibleInClip } from "./floating-utils";

const CELL_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#e5e7eb" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Green", value: "#dcfce7" },
  { label: "Yellow", value: "#fef9c3" },
  { label: "Red", value: "#fee2e2" },
] as const;

const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#6b7280" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#15803d" },
  { label: "Red", value: "#b91c1c" },
] as const;

type ButtonPosition = { x: number; y: number };

type MenuState = {
  tableKey: NodeKey;
  cellKeys: NodeKey[];
  canMerge: boolean;
  canSplit: boolean;
  headerRow: boolean;
  headerColumn: boolean;
};

function $cellFrom(node: LexicalNode | null): TableCellNode | null {
  if (!node) return null;
  if ($isTableCellNode(node)) return node;
  return $findMatchingParent(node, $isTableCellNode);
}

function $activeCell(): TableCellNode | null {
  const selection = $getSelection();
  if ($isRangeSelection(selection) || $isTableSelection(selection)) {
    return $cellFrom(selection.focus.getNode());
  }
  return null;
}

function $selectedCells(): TableCellNode[] {
  const selection = $getSelection();
  if ($isTableSelection(selection)) {
    return selection.getNodes().filter($isTableCellNode);
  }
  const cell = $activeCell();
  return cell ? [cell] : [];
}

function $firstCell(table: TableNode): TableCellNode | null {
  const row = table.getFirstChild();
  const cell = $isTableRowNode(row) ? row.getFirstChild() : null;
  return $isTableCellNode(cell) ? cell : null;
}

function $readMenuState(): MenuState | null {
  const cells = $selectedCells();
  const cell = cells[cells.length - 1];
  const table = cell ? $findTableNode(cell) : null;
  if (!cell || !table) return null;
  const first = $firstCell(table);
  return {
    tableKey: table.getKey(),
    cellKeys: cells.map((node) => node.getKey()),
    canMerge: cells.length > 1,
    canSplit: cell.getColSpan() > 1 || cell.getRowSpan() > 1,
    headerRow: !!first?.hasHeaderState(TableCellHeaderStates.ROW),
    headerColumn: !!first?.hasHeaderState(TableCellHeaderStates.COLUMN),
  };
}

export function TableCellActionMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t, dir } = useTranslation();
  const [cellKey, setCellKey] = useState<NodeKey | null>(null);
  const [position, setPosition] = useState<ButtonPosition | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const updatePosition = useCallback(() => {
    const element = cellKey ? editor.getElementByKey(cellKey) : null;
    if (!element) {
      setPosition(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    const table = element.closest("table");
    if (table && !isRectVisibleInClip(rect, getTableClipRect(table))) {
      setPosition(null);
      return;
    }
    const isRTL = getComputedStyle(element).direction === "rtl";
    setPosition({ x: isRTL ? rect.left + 4 : rect.right - 4, y: rect.top + 4 });
  }, [cellKey, editor]);

  useEffect(() => {
    if (!isEditable) return;
    return editor.registerUpdateListener(({ editorState }) => {
      const next = editorState.read(() => $activeCell()?.getKey() ?? null);
      setCellKey((current) => (current === next ? current : next));
    });
  }, [editor, isEditable]);

  useEffect(() => {
    queueMicrotask(updatePosition);
    return mergeRegister(
      registerEventListener(window, "resize", updatePosition),
      registerEventListener(document, "scroll", updatePosition, true),
      editor.registerUpdateListener(updatePosition),
    );
  }, [editor, updatePosition]);

  const withTable = (apply: (table: TableNode, state: MenuState) => void) => {
    if (!menu) return;
    editor.update(() => {
      const table = $getNodeByKey(menu.tableKey);
      if ($isTableNode(table)) apply(table, menu);
    });
  };

  const $cells = (state: MenuState) =>
    state.cellKeys
      .map((key) => $getNodeByKey(key))
      .filter($isTableCellNode);

  if (!isEditable || !cellKey || !position) return null;

  const isRTL = dir === "rtl";

  return createPortal(
    <div
      className="fixed z-10"
      style={{
        left: position.x,
        top: position.y,
        transform: isRTL ? undefined : "translateX(-100%)",
      }}
    >
      <DropdownMenu
        open={menu !== null}
        onOpenChange={(open) => {
          setMenu(open ? editor.read($readMenuState) : null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t.tableCellActions}
            title={t.tableCellActions}
            className="flex size-5 cursor-pointer items-center justify-center rounded-sm border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(event) => event.preventDefault()}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        {menu ? (
          <DropdownMenuContent
            align="start"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.focus();
            }}
          >
            <DropdownMenuCheckboxItem
              checked={menu.headerRow}
              aria-label={t.tableHeaderRow}
              onCheckedChange={(checked) =>
                withTable((table) => $setTableRowIsHeader(table, 0, checked))
              }
            >
              {t.tableHeaderRow}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={menu.headerColumn}
              aria-label={t.tableHeaderColumn}
              onCheckedChange={(checked) =>
                withTable((table) => $setTableColumnIsHeader(table, 0, checked))
              }
            >
              {t.tableHeaderColumn}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!menu.canMerge}
              onSelect={() =>
                withTable((_, state) => {
                  const merged = $mergeCells($cells(state));
                  merged?.selectEnd();
                })
              }
            >
              {t.mergeTableCells}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!menu.canSplit}
              onSelect={() =>
                withTable((_, state) => {
                  const cell = $cells(state).at(-1);
                  if (cell) $unmergeCellNode(cell);
                })
              }
            >
              {t.splitTableCell}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t.tableCellColor}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CELL_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color.label}
                    onSelect={() =>
                      withTable((_, state) => {
                        for (const cell of $cells(state)) {
                          cell.setBackgroundColor(color.value);
                        }
                      })
                    }
                  >
                    <span
                      aria-hidden
                      className="size-3.5 rounded-sm border"
                      style={{ backgroundColor: color.value ?? undefined }}
                    />
                    {color.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t.tableTextColor}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TEXT_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color.label}
                    onSelect={() =>
                      withTable((_, state) => {
                        for (const cell of $cells(state)) {
                          const selection = cell.select(0, cell.getChildrenSize());
                          $patchStyleText(selection, { color: color.value });
                        }
                      })
                    }
                  >
                    <span
                      aria-hidden
                      className="size-3.5 rounded-full border"
                      style={{ backgroundColor: color.value ?? undefined }}
                    />
                    {color.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        ) : null}
      </DropdownMenu>
    </div>,
    document.body,
  );
}
