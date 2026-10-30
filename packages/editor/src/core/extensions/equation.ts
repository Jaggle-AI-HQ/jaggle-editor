import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  type LexicalCommand,
} from "lexical";

import {
  $createEquationNode,
  EquationNode,
} from "../nodes/equation-node";

export type InsertEquationPayload = {
  equation: string;
  inline: boolean;
};

export const INSERT_EQUATION_COMMAND: LexicalCommand<InsertEquationPayload> =
  createCommand("INSERT_EQUATION_COMMAND");

export const EquationExtension = defineExtension({
  name: "@jaggle/lexical/equation",
  nodes: () => [EquationNode],
  register: (editor) =>
    editor.registerCommand(
      INSERT_EQUATION_COMMAND,
      ({ equation, inline }) => {
        const equationNode = $createEquationNode(equation, inline);
        if (inline) {
          $insertNodes([equationNode]);
          if ($isRootOrShadowRoot(equationNode.getParentOrThrow())) {
            const paragraph = $createParagraphNode();
            equationNode.replace(paragraph);
            paragraph.append(equationNode);
            paragraph.selectEnd();
          }
          return true;
        }
        const selection = $getSelection();
        const top = $isRangeSelection(selection)
          ? selection.anchor.getNode().getTopLevelElement()
          : null;
        const paragraph = $createParagraphNode();
        if (top && top.getParent()) {
          top.insertAfter(equationNode);
        } else {
          $getRoot().append(equationNode);
        }
        equationNode.insertAfter(paragraph);
        paragraph.selectEnd();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
});
