import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  type LexicalCommand,
} from "lexical";

import { $createTweetNode, TweetNode } from "../nodes/tweet-node";

export const INSERT_TWEET_COMMAND: LexicalCommand<string> = createCommand(
  "INSERT_TWEET_COMMAND",
);

export const TweetExtension = defineExtension({
  name: "@jaggle/lexical/tweet",
  nodes: () => [TweetNode],
  register: (editor) =>
    editor.registerCommand(
      INSERT_TWEET_COMMAND,
      (tweetID) => {
        const tweetNode = $createTweetNode(tweetID);
        const selection = $getSelection();
        const top = $isRangeSelection(selection)
          ? selection.anchor.getNode().getTopLevelElement()
          : null;
        const paragraph = $createParagraphNode();
        if (top && top.getParent()) {
          top.insertAfter(tweetNode);
        } else {
          $getRoot().append(tweetNode);
        }
        tweetNode.insertAfter(paragraph);
        paragraph.selectEnd();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
});
