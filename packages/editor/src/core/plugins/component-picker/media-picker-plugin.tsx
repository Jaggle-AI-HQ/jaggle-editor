import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { AudioLines, FileUp, Film } from "lucide-react";

import {
  INSERT_AUDIO_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_VIDEO_COMMAND,
} from "../../extensions/media";
import { useTranslation } from "../../lib/locale";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function VideoPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "video",
        label: t.insertVideo,
        icon: <Film className="text-muted-foreground" />,
        keywords: ["video", "mp4", "movie", "film", "media"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src: "", name: "" }),
      },
    ],
    [t, editor],
  );
  useComponentPickerItems(items);
  return null;
}

export function AudioPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "audio",
        label: t.insertAudio,
        icon: <AudioLines className="text-muted-foreground" />,
        keywords: ["audio", "mp3", "sound", "music", "media"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_AUDIO_COMMAND, { src: "", name: "" }),
      },
    ],
    [t, editor],
  );
  useComponentPickerItems(items);
  return null;
}

export function FilePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "file",
        label: t.insertFile,
        icon: <FileUp className="text-muted-foreground" />,
        keywords: ["file", "attachment", "pdf", "document", "download"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_FILE_COMMAND, { src: "", name: "" }),
      },
    ],
    [t, editor],
  );
  useComponentPickerItems(items);
  return null;
}
