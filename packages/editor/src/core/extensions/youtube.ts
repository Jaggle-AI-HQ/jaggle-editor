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

import { $createYouTubeNode, YouTubeNode } from "../nodes/youtube-node";

export const INSERT_YOUTUBE_COMMAND: LexicalCommand<string> = createCommand(
  "INSERT_YOUTUBE_COMMAND",
);

export const YouTubeExtension = defineExtension({
  name: "@jaggle/lexical/youtube",
  nodes: () => [YouTubeNode],
  register: (editor) =>
    editor.registerCommand(
      INSERT_YOUTUBE_COMMAND,
      (videoID) => {
        const youtubeNode = $createYouTubeNode(videoID);
        const selection = $getSelection();
        const top = $isRangeSelection(selection)
          ? selection.anchor.getNode().getTopLevelElement()
          : null;
        const paragraph = $createParagraphNode();
        if (top && top.getParent()) {
          top.insertAfter(youtubeNode);
        } else {
          $getRoot().append(youtubeNode);
        }
        youtubeNode.insertAfter(paragraph);
        paragraph.selectEnd();
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
});
