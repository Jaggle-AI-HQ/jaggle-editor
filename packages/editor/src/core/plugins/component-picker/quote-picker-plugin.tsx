import { useMemo } from "react";


import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $getRoot, $getSelection } from "lexical";
import { TextQuote } from "lucide-react";

import { useTranslation } from "../../lib/locale";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function QuotePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "quote",
        label: t.quote,
        icon: <TextQuote className="text-muted-foreground" />,
        keywords: ["quote", "block quote", "blockquote"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection() ?? $getRoot().selectEnd();
            $setBlocksType(selection, () => $createQuoteNode());
          }),
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
