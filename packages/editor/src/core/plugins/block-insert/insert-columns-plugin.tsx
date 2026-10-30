import { useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $getRoot, $getSelection, type LexicalEditor } from "lexical";
import { Columns2 } from "lucide-react";

import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";

import { INSERT_LAYOUT_COMMAND } from "../../extensions/layout";
import { useTranslation, type Locale } from "../../lib/locale";

type ColumnOption = {
  value: string;
  labelKey: keyof Locale;
  templateColumns: string;
};

const COLUMN_OPTIONS: ColumnOption[] = [
  { value: "one", labelKey: "columnsOne", templateColumns: "1fr" },
  { value: "two", labelKey: "columnsTwo", templateColumns: "1fr 1fr" },
  { value: "three", labelKey: "columnsThree", templateColumns: "1fr 1fr 1fr" },
];

export function insertColumns(
  editor: LexicalEditor,
  templateColumns: string,
) {
  editor.update(() => {
    if (!$getSelection()) {
      $getRoot().selectEnd();
    }
  });
  editor.dispatchCommand(INSERT_LAYOUT_COMMAND, templateColumns);
}

export function InsertColumnsPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t.columns}
              disabled={!isEditable}
            >
              <Columns2 />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t.columns}</TooltipContent>
      </Tooltip>
      {open ? (
        <DropdownMenuContent align="start">
          {COLUMN_OPTIONS.map(({ value, labelKey, templateColumns }) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => insertColumns(editor, templateColumns)}
            >
              {t[labelKey]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
}
