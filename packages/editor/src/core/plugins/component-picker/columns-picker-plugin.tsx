import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Columns2,
  Columns3,
  type LucideIcon,
  RectangleVertical,
} from "lucide-react";

import { useTranslation, type Locale } from "../../lib/locale";
import { insertColumns } from "../block-insert/insert-columns-plugin";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

const COLUMN_ITEMS: {
  value: string;
  labelKey: keyof Locale;
  icon: LucideIcon;
  templateColumns: string;
}[] = [
  {
    value: "columns-one",
    labelKey: "columnsOne",
    icon: RectangleVertical,
    templateColumns: "1fr",
  },
  {
    value: "columns-two",
    labelKey: "columnsTwo",
    icon: Columns2,
    templateColumns: "1fr 1fr",
  },
  {
    value: "columns-three",
    labelKey: "columnsThree",
    icon: Columns3,
    templateColumns: "1fr 1fr 1fr",
  },
];

export function ColumnsPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () =>
      COLUMN_ITEMS.map(({ value, labelKey, icon: Icon, templateColumns }) => ({
        value,
        label: t[labelKey],
        icon: <Icon className="text-muted-foreground" />,
        keywords: ["columns", "layout", "grid"],
        onSelect: () => insertColumns(editor, templateColumns),
      })),
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
