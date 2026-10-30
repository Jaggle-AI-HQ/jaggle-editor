import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection } from "lexical";
import { Star } from "lucide-react";

import { INSERT_REVIEW_COMMAND } from "../../extensions/review";
import { useTranslation } from "../../lib/locale";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function ReviewPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "review",
        label: t.insertReview,
        icon: <Star className="text-muted-foreground" />,
        keywords: ["review", "rating", "stars", "star", "feedback"],
        onSelect: () => {
          editor.update(() => {
            if (!$getSelection()) {
              $getRoot().selectEnd();
            }
          });
          editor.dispatchCommand(INSERT_REVIEW_COMMAND, undefined);
        },
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);
  return null;
}
