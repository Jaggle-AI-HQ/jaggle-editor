import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  type LexicalCommand,
  type LexicalEditor,
} from "lexical";

import {
  $createAudioNode,
  $createFileNode,
  $createVideoNode,
  AudioNode,
  FileNode,
  type MediaPayload,
  VideoNode,
} from "../nodes/media-node";

export const INSERT_VIDEO_COMMAND: LexicalCommand<MediaPayload> =
  createCommand("INSERT_VIDEO_COMMAND");
export const INSERT_AUDIO_COMMAND: LexicalCommand<MediaPayload> =
  createCommand("INSERT_AUDIO_COMMAND");
export const INSERT_FILE_COMMAND: LexicalCommand<MediaPayload> =
  createCommand("INSERT_FILE_COMMAND");

function $insertMediaBlock(
  create: () => VideoNode | AudioNode | FileNode,
): boolean {
  $insertMediaBlockNode(create);
  return true;
}

/** Inserts a video, audio or file block for an upload; returns the node. */
export function $insertMediaNode(
  kind: "video" | "audio" | "file",
  payload: MediaPayload,
): VideoNode | AudioNode | FileNode {
  return $insertMediaBlockNode(() =>
    kind === "video"
      ? $createVideoNode(payload)
      : kind === "audio"
        ? $createAudioNode(payload)
        : $createFileNode(payload),
  );
}

/** Puts the block below the caret's block, caret in a new paragraph after it. */
function $insertMediaBlockNode(
  create: () => VideoNode | AudioNode | FileNode,
): VideoNode | AudioNode | FileNode {
  const node = create();
  const selection = $getSelection();
  const top = $isRangeSelection(selection)
    ? selection.anchor.getNode().getTopLevelElement()
    : null;
  const paragraph = $createParagraphNode();
  if (top && top.getParent()) {
    top.insertAfter(node);
  } else {
    $getRoot().append(node);
  }
  node.insertAfter(paragraph);
  paragraph.selectEnd();
  return node;
}

function registerInsertMediaCommands(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_VIDEO_COMMAND,
      (payload) => $insertMediaBlock(() => $createVideoNode(payload)),
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      INSERT_AUDIO_COMMAND,
      (payload) => $insertMediaBlock(() => $createAudioNode(payload)),
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      INSERT_FILE_COMMAND,
      (payload) => $insertMediaBlock(() => $createFileNode(payload)),
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

export const MediaExtension = defineExtension({
  name: "@jaggle/lexical/media",
  nodes: () => [VideoNode, AudioNode, FileNode],
  register: registerInsertMediaCommands,
});
