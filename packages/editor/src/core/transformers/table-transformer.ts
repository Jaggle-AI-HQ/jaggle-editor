import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type ElementTransformer,
  type Transformer,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $isParagraphNode, $isTextNode, type LexicalNode } from "lexical";

const TABLE_ROW = /^\|(.+)\|\s?$/;
const TABLE_DIVIDER = /^(\| ?:?-*:? ?)+\|\s?$/;

/**
 * GFM tables (`| a | b |` rows, `| --- |` under the header). Lexical ships no
 * table transformer; this follows the Lexical playground's. Cells hold inline
 * Markdown, with `\n` standing for a line break inside a cell.
 *
 * Cells are converted with `cellTransformers`, which must not include this
 * transformer (a table inside a cell is not valid Markdown).
 */
export function createTableTransformer(
  cellTransformers: Transformer[],
): ElementTransformer {
  const $createCell = (markdown: string) => {
    const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
    $convertFromMarkdownString(
      markdown.trim().replace(/\\n/g, "\n"),
      cellTransformers,
      cell,
    );
    return cell;
  };

  const $rowCells = (line: string) => {
    const match = line.match(TABLE_ROW);
    return match?.[1]
      ? match[1]
          .split(/(?<!\\)\|/)
          .map((cell) => $createCell(cell.replace(/\\\|/g, "|")))
      : null;
  };

  const columnCount = (table: TableNode) => {
    const row = table.getFirstChild();
    return $isTableRowNode(row) ? row.getChildrenSize() : 0;
  };

  return {
    dependencies: [TableNode, TableRowNode, TableCellNode],
    export: (node: LexicalNode) => {
      if (!$isTableNode(node)) {
        return null;
      }
      const lines: string[] = [];
      for (const row of node.getChildren()) {
        if (!$isTableRowNode(row)) {
          continue;
        }
        const cells: string[] = [];
        let isHeader = false;
        for (const cell of row.getChildren()) {
          if (!$isTableCellNode(cell)) {
            continue;
          }
          cells.push(
            $convertToMarkdownString(cellTransformers, cell)
              .replace(/\n/g, "\\n")
              .replace(/\|/g, "\\|")
              .trim(),
          );
          if (cell.getHeaderStyles() & TableCellHeaderStates.ROW) {
            isHeader = true;
          }
        }
        lines.push(`| ${cells.join(" | ")} |`);
        if (isHeader) {
          lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        }
      }
      return lines.join("\n");
    },
    regExp: TABLE_ROW,
    replace: (parentNode, _children, match, isImport) => {
      // The divider marks the row above it as the header row.
      if (TABLE_DIVIDER.test(match[0])) {
        const table = parentNode.getPreviousSibling();
        if (!$isTableNode(table)) {
          return;
        }
        const lastRow = table.getLastChild();
        if (!$isTableRowNode(lastRow)) {
          return;
        }
        for (const cell of lastRow.getChildren()) {
          if ($isTableCellNode(cell)) {
            cell.setHeaderStyles(
              TableCellHeaderStates.ROW,
              TableCellHeaderStates.ROW,
            );
          }
        }
        parentNode.remove();
        return;
      }

      const cells = $rowCells(match[0]);
      if (!cells) {
        return;
      }

      // Typed rows arrive one paragraph at a time; gather the ones above.
      const rows = [cells];
      let maxCells = cells.length;
      let sibling = parentNode.getPreviousSibling();
      while (
        $isParagraphNode(sibling) &&
        sibling.getChildrenSize() === 1 &&
        $isTextNode(sibling.getFirstChild())
      ) {
        const siblingCells = $rowCells(sibling.getTextContent());
        if (!siblingCells) {
          break;
        }
        maxCells = Math.max(maxCells, siblingCells.length);
        rows.unshift(siblingCells);
        const previous: LexicalNode | null = sibling.getPreviousSibling();
        sibling.remove();
        sibling = previous;
      }

      const table = $createTableNode();
      for (const rowCells of rows) {
        const row = $createTableRowNode();
        table.append(row);
        for (let index = 0; index < maxCells; index++) {
          row.append(rowCells[index] ?? $createCell(""));
        }
      }

      const previous = parentNode.getPreviousSibling();
      if ($isTableNode(previous) && columnCount(previous) === maxCells) {
        previous.append(...table.getChildren());
        parentNode.remove();
      } else {
        parentNode.replace(table);
      }
      if (!isImport) {
        table.selectEnd();
      }
    },
    type: "element",
  };
}
