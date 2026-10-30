"use client";

import type { JSX } from "react";

import { DecoratorBlockNode } from "@lexical/react/LexicalDecoratorBlockNode";
import {
  $applyNodeReplacement,
  $getDocument,
  $getNodeByKey,
  $getState,
  $setState,
  createState,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type StateConfigValue,
  type StateValueOrUpdater,
} from "lexical";

import { type BoardChange, BoardView } from "../components/board/board-view";
import {
  BOARD_CLASSES,
  BOARD_COLOR_CLASSES,
  type BoardColumns,
  boardTextContent,
  createDefaultBoardColumns,
  formatBoardDate,
  parseBoardColumns,
} from "../lib/board";

const titleState = createState("title", {
  parse: (v) => (typeof v === "string" ? v : ""),
});

const columnsState = createState("columns", {
  isEqual: (a, b) =>
    a.length === b.length && JSON.stringify(a) === JSON.stringify(b),
  parse: parseBoardColumns,
});

function updateBoardNode(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  change: BoardChange,
) {
  editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if (!$isBoardNode(node)) {
      return;
    }
    if (change.title !== undefined) {
      node.setTitle(change.title);
    }
    if (change.columns) {
      node.setColumns(change.columns);
    }
  });
}

export class BoardNode extends DecoratorBlockNode {
  $config() {
    return this.config("board", {
      extends: DecoratorBlockNode,
      stateConfigs: [
        { flat: true, stateConfig: titleState },
        { flat: true, stateConfig: columnsState },
      ],
    });
  }

  getTitle(): StateConfigValue<typeof titleState> {
    return $getState(this, titleState);
  }

  setTitle(valueOrUpdater: StateValueOrUpdater<typeof titleState>): this {
    return $setState(this, titleState, valueOrUpdater);
  }

  getColumns(): StateConfigValue<typeof columnsState> {
    return $getState(this, columnsState);
  }

  setColumns(valueOrUpdater: StateValueOrUpdater<typeof columnsState>): this {
    return $setState(this, columnsState, valueOrUpdater);
  }

  getTextContent(): string {
    return boardTextContent(this.getTitle(), this.getColumns());
  }

  exportDOM(): DOMExportOutput {
    const doc = $getDocument();
    const title = this.getTitle();
    const columns = this.getColumns();

    const element = doc.createElement("div");
    element.setAttribute("data-lexical-board", "");
    element.setAttribute("data-board-title", title);
    element.setAttribute("data-board-columns", JSON.stringify(columns));
    element.className = BOARD_CLASSES.root;

    if (title) {
      const heading = doc.createElement("p");
      heading.className = BOARD_CLASSES.title;
      heading.textContent = title;
      element.append(heading);
    }

    const row = doc.createElement("div");
    row.className = BOARD_CLASSES.row;
    for (const column of columns) {
      const colors = BOARD_COLOR_CLASSES[column.color];
      const columnElement = doc.createElement("div");
      columnElement.className = `${BOARD_CLASSES.column} ${colors.column}`;

      const header = doc.createElement("div");
      header.className = BOARD_CLASSES.header;
      const pill = doc.createElement("span");
      pill.className = `${BOARD_CLASSES.pill} ${colors.pill}`;
      pill.textContent = column.title;
      const count = doc.createElement("span");
      count.className = BOARD_CLASSES.count;
      count.textContent = String(column.cards.length);
      header.append(pill, count);
      columnElement.append(header);

      for (const card of column.cards) {
        const cardElement = doc.createElement("div");
        cardElement.className = BOARD_CLASSES.card;
        cardElement.textContent = card.title;
        if (card.dueDate || card.assignees.length > 0) {
          const meta = doc.createElement("div");
          meta.className = BOARD_CLASSES.meta;
          if (card.dueDate) {
            const due = doc.createElement("time");
            due.setAttribute("datetime", card.dueDate);
            due.textContent = formatBoardDate(card.dueDate);
            meta.append(due);
          }
          if (card.assignees.length > 0) {
            const people = doc.createElement("span");
            people.className = "ms-auto";
            people.textContent = card.assignees
              .map((person) => person.name)
              .join(", ");
            meta.append(people);
          }
          cardElement.append(meta);
        }
        columnElement.append(cardElement);
      }
      row.append(columnElement);
    }
    element.append(row);
    return { element };
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {};
    const nodeKey = this.getKey();
    return (
      <BoardView
        nodeKey={nodeKey}
        onChange={(change) => updateBoardNode(editor, nodeKey, change)}
        title={this.getTitle()}
        columns={this.getColumns()}
        focusClassName={embedBlockTheme.focus || ""}
      />
    );
  }
}

export function $createBoardNode(
  title = "",
  columns: BoardColumns = createDefaultBoardColumns(),
): BoardNode {
  return $applyNodeReplacement(new BoardNode())
    .setTitle(title)
    .setColumns(columns);
}

export function $isBoardNode(
  node: LexicalNode | null | undefined,
): node is BoardNode {
  return node instanceof BoardNode;
}
