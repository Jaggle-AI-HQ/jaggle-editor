import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection } from "lexical";
import { Quote } from "lucide-react";

import { INSERT_PULLQUOTE_COMMAND } from "../../extensions/pullquote";
import { useTranslation } from "../../lib/locale";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function PullQuotePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "pullquote",
        label: t.insertPullQuote,
        icon: <Quote className="text-muted-foreground" />,
        keywords: ["pullquote", "pull", "quote", "citation", "blockquote"],
        onSelect: () => {
          editor.update(() => {
            if (!$getSelection()) {
              $getRoot().selectEnd();
            }
          });
          editor.dispatchCommand(INSERT_PULLQUOTE_COMMAND, undefined);
        },
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
