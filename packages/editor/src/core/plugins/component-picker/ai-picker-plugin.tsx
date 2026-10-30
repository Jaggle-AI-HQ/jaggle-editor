import { useMemo } from "react";

import { Sparkles } from "lucide-react";

import { useDocumentUi } from "../../document/ui-context";
import { useTranslation } from "../../lib/locale";
import { selectionAnchor } from "../toolbar/ai-toolbar-plugin";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

export function AiPickerPlugin() {
  const { t } = useTranslation();
  const { openAi } = useDocumentUi();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "ask-ai",
        label: t.askAi,
        icon: <Sparkles className="text-muted-foreground" />,
        keywords: ["ai", "ask", "assistant", "generate", "write"],
        onSelect: () => {
          queueMicrotask(() => openAi(selectionAnchor()));
        },
      },
    ],
    [t, openAi],
  );

  useComponentPickerItems(items);

  return null;
}
