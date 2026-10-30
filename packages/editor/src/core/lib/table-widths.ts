import { getTableElement, type TableNode } from "@lexical/table";
import type { LexicalEditor } from "lexical";

export const MIN_COLUMN_WIDTH = 92;

/**
 * The table's column widths: the stored ones, or, for a table that was never
 * resized (no stored widths, or a column added since), the rendered widths.
 */
export function measureColumnWidths(
  tableNode: TableNode,
  editor: LexicalEditor,
  columnCount: number,
): number[] {
  const existing = tableNode.getColWidths();
  if (existing && existing.length === columnCount) {
    return [...existing];
  }

  const tableElement = getTableElement(
    tableNode,
    editor.getElementByKey(tableNode.getKey()),
  );
  const firstRow = tableElement?.rows[0];
  const widths: number[] = [];
  if (firstRow) {
    for (const cell of Array.from(firstRow.cells)) {
      const span = cell.colSpan || 1;
      const width = cell.getBoundingClientRect().width / span;
      for (let index = 0; index < span; index++) {
        widths.push(Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
      }
    }
  }
  while (widths.length < columnCount) {
    widths.push(MIN_COLUMN_WIDTH);
  }
  return widths.slice(0, columnCount);
}
