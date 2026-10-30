import { useRef } from "react";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  type LexicalCommand,
  OUTDENT_CONTENT_COMMAND,
  type RangeSelection,
} from "lexical";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  IndentDecrease,
  IndentIncrease,
  type LucideIcon,
  PilcrowLeft,
  PilcrowRight,
} from "lucide-react";

import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "../../../ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";

import { toolbarPressedClass } from "../../components/toolbar-button";
import { useFormatStateValue } from "../../extensions/format-state";
import { formatShortcut } from "../../extensions/shortcuts";
import { type Locale, useTranslation } from "../../lib/locale";
import { useFloatingCollisionBoundary } from "../floating/floating-utils";

type AlignItem = {
  value: Exclude<ElementFormatType, "">;
  labelKey: keyof Locale;
  icon: LucideIcon;
};

function AlignToggleGroup({ items }: { items: AlignItem[] }) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const elementFormat = useFormatStateValue("elementFormat");
  const isEditable = useLexicalEditable();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      disabled={!isEditable}
      value={elementFormat}
      onValueChange={(value) => {
        const next = value as Exclude<ElementFormatType, ""> | "";
        if (next) {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, next);
        }
      }}
    >
      {items.map(({ value, labelKey, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={value}
              aria-label={t[labelKey]}
              className={toolbarPressedClass(elementFormat === value)}
            >
              <Icon />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{t[labelKey]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

export function ElementFormatToolbarPlugin({
  formats = "all",
}: {
  formats?: "basic" | "all";
}) {
  const { dir } = useTranslation();
  const isRtl = dir === "rtl";

  const alignGroups: AlignItem[][] = [
    [
      { value: "left", icon: AlignLeft, labelKey: "alignLeft" },
      { value: "center", icon: AlignCenter, labelKey: "alignCenter" },
      { value: "right", icon: AlignRight, labelKey: "alignRight" },
      { value: "justify", icon: AlignJustify, labelKey: "alignJustify" },
    ],
    [
      {
        value: "start",
        icon: isRtl ? PilcrowRight : PilcrowLeft,
        labelKey: "alignStart",
      },
      {
        value: "end",
        icon: isRtl ? PilcrowLeft : PilcrowRight,
        labelKey: "alignEnd",
      },
    ],
  ];

  const groups = formats === "basic" ? alignGroups.slice(0, 1) : alignGroups;

  return (
    <>
      {groups.map((items, groupIndex) => (
        <AlignToggleGroup key={groupIndex} items={items} />
      ))}
    </>
  );
}

const MENU_ALIGNMENTS: (AlignItem & {
  shortcut: "LEFT_ALIGN" | "CENTER_ALIGN" | "RIGHT_ALIGN" | "JUSTIFY_ALIGN";
})[] = [
  { value: "left", icon: AlignLeft, labelKey: "alignLeft", shortcut: "LEFT_ALIGN" },
  { value: "center", icon: AlignCenter, labelKey: "alignCenter", shortcut: "CENTER_ALIGN" },
  { value: "right", icon: AlignRight, labelKey: "alignRight", shortcut: "RIGHT_ALIGN" },
  { value: "justify", icon: AlignJustify, labelKey: "alignJustify", shortcut: "JUSTIFY_ALIGN" },
];

const ALIGNMENT_ICONS: Record<Exclude<ElementFormatType, "">, LucideIcon> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
  start: PilcrowLeft,
  end: PilcrowRight,
};

/**
 * Alignment and indentation for the blocks in the selection, as one menu in
 * the floating toolbar. The trigger shows the current alignment. Start and
 * end (writing-direction alignment) stay in the slash menu.
 */
export function AlignmentMenu({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const { t, dir } = useTranslation();
  const isEditable = useLexicalEditable();
  const elementFormat = useFormatStateValue("elementFormat");
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const selectedRangeRef = useRef<RangeSelection | null>(null);
  const current: Exclude<ElementFormatType, ""> =
    elementFormat || (dir === "rtl" ? "right" : "left");
  const CurrentIcon = ALIGNMENT_ICONS[current];

  const rememberSelection = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      selectedRangeRef.current = $isRangeSelection(selection)
        ? selection.clone()
        : null;
    });
  };

  // The menu takes focus; run the command on the selection it opened from and
  // hand focus back so the selection and the toolbar stay.
  const run = <P,>(command: LexicalCommand<P>, payload: P) => {
    const selectedRange = selectedRangeRef.current;
    editor.update(() => {
      if (selectedRange) {
        $setSelection(selectedRange.clone());
      }
      editor.dispatchCommand(command, payload);
    });
    requestAnimationFrame(() => editor.focus());
  };

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (open) {
          rememberSelection();
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isEditable}
              aria-label={t.textAlignment}
              className="gap-0.5 px-1.5"
              onMouseDown={(event) => {
                rememberSelection();
                event.preventDefault();
              }}
            >
              <CurrentIcon className="size-4.5" />
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t.textAlignment}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        data-floating-format-menu=""
        align="end"
        sideOffset={8}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        className="w-56"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => {
          const root = editor.getRootElement();
          if (root && event.target instanceof Node && root.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        {MENU_ALIGNMENTS.map(({ value, labelKey, icon: Icon, shortcut }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={current === value}
            onCheckedChange={() => run(FORMAT_ELEMENT_COMMAND, value)}
          >
            <Icon />
            {t[labelKey]}
            <DropdownMenuShortcut>{formatShortcut(shortcut).join("")}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem inset onSelect={() => run(INDENT_CONTENT_COMMAND, undefined)}>
          <IndentIncrease />
          {t.indent}
          <DropdownMenuShortcut>{formatShortcut("INDENT").join("")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem inset onSelect={() => run(OUTDENT_CONTENT_COMMAND, undefined)}>
          <IndentDecrease />
          {t.outdent}
          <DropdownMenuShortcut>{formatShortcut("OUTDENT").join("")}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
