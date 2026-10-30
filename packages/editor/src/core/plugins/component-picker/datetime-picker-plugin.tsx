import { useMemo } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { addDays } from "date-fns";
import { $getRoot, $getSelection, type LexicalEditor } from "lexical";
import {
  CalendarCheck,
  CalendarDays,
  CalendarMinus,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";

import { INSERT_DATETIME_COMMAND } from "../../extensions/datetime";
import { useTranslation, type Locale } from "../../lib/locale";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

const DATETIME_ITEMS: {
  value: string;
  labelKey: keyof Locale;
  icon: LucideIcon;
  offsetDays: number;
  keywords: string[];
}[] = [
  {
    value: "datetime",
    labelKey: "insertDateTime",
    icon: CalendarDays,
    offsetDays: 0,
    keywords: ["date", "time", "datetime", "calendar"],
  },
  {
    value: "datetime-today",
    labelKey: "dateTimeToday",
    icon: CalendarCheck,
    offsetDays: 0,
    keywords: ["today", "date", "now"],
  },
  {
    value: "datetime-tomorrow",
    labelKey: "dateTimeTomorrow",
    icon: CalendarPlus,
    offsetDays: 1,
    keywords: ["tomorrow", "date"],
  },
  {
    value: "datetime-yesterday",
    labelKey: "dateTimeYesterday",
    icon: CalendarMinus,
    offsetDays: -1,
    keywords: ["yesterday", "date"],
  },
];

function insertDateTime(editor: LexicalEditor, offsetDays: number) {
  editor.update(() => {
    if (!$getSelection()) {
      $getRoot().selectEnd();
    }
  });
  const date = addDays(new Date(), offsetDays);
  date.setHours(0, 0, 0, 0);
  editor.dispatchCommand(INSERT_DATETIME_COMMAND, { dateTime: date });
}

export function DateTimePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () =>
      DATETIME_ITEMS.map(
        ({ value, labelKey, icon: Icon, offsetDays, keywords }) => ({
          value,
          label: t[labelKey],
          icon: <Icon className="text-muted-foreground" />,
          keywords,
          onSelect: () => insertDateTime(editor, offsetDays),
        }),
      ),
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
