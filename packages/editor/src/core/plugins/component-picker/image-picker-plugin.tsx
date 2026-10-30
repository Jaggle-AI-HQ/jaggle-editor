import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ImageIcon } from "lucide-react";

import { useTranslation } from "../../lib/locale";
import { INSERT_IMAGE_COMMAND } from "../../nodes/image-node";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function ImagePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "image",
        label: t.insertImage,
        icon: <ImageIcon className="text-muted-foreground" />,
        keywords: ["image", "photo", "picture", "file", "img"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
            src: "",
            altText: "",
          }),
      },
    ],
    [t, editor],
  );

  useComponentPickerItems(items);

  return null;
}
