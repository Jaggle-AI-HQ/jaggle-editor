import { useRef, useState } from "react";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { $patchStyleText } from "@lexical/selection";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  FORMAT_TEXT_COMMAND,
  type RangeSelection,
  type TextFormatType,
} from "lexical";
import {
  Baseline,
  Bold,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Code,
  Highlighter,
  Italic,
  type LucideIcon,
  Minus,
  PaintBucket,
  Plus,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "lucide-react";

import { Button } from "../../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import { Input } from "../../../ui/input";
import { ToggleGroup, ToggleGroupItem } from "../../../ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";
import { cn } from "../../../lib/utils";

import { toolbarPressedClass } from "../../components/toolbar-button";
import { clearFormatting, useFormatStateValue } from "../../extensions/format-state";
import { type Locale, useTranslation } from "../../lib/locale";
import { useFloatingCollisionBoundary } from "../floating/floating-utils";

const FORMAT_GROUPS: {
  format: TextFormatType;
  labelKey: keyof Locale;
  icon: LucideIcon;
}[][] = [
  [
    { format: "bold", labelKey: "bold", icon: Bold },
    { format: "italic", labelKey: "italic", icon: Italic },
    { format: "underline", labelKey: "underline", icon: Underline },
    { format: "strikethrough", labelKey: "strikethrough", icon: Strikethrough },
  ],
  [
    { format: "highlight", labelKey: "highlight", icon: Highlighter },
    { format: "code", labelKey: "inlineCode", icon: Code },
  ],
  [
    { format: "subscript", labelKey: "subscript", icon: Subscript },
    { format: "superscript", labelKey: "superscript", icon: Superscript },
  ],
  [
    { format: "uppercase", labelKey: "uppercase", icon: CaseUpper },
    { format: "lowercase", labelKey: "lowercase", icon: CaseLower },
    { format: "capitalize", labelKey: "titleCase", icon: CaseSensitive },
  ],
];

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 16;

function FormatToggleGroup({
  items,
}: {
  items: (typeof FORMAT_GROUPS)[number];
}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const formats = useFormatStateValue("formats");
  const isEditable = useLexicalEditable();
  return (
    <ToggleGroup
      type="multiple"
      variant="default"
      size="sm"
      spacing={1}
      className="gap-0.5"
      disabled={!isEditable}
      value={formats}
      onValueChange={(value) => {
        const next = new Set(value as TextFormatType[]);
        for (const { format } of items) {
          if (next.has(format) !== formats.includes(format)) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
          }
        }
      }}
    >
      {items.map(({ format, labelKey, icon: Icon }) => (
        <Tooltip key={format}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={format}
              aria-label={t[labelKey]}
              className={cn(toolbarPressedClass(formats.includes(format)))}
              onMouseDown={(event) => event.preventDefault()}
            >
              <Icon className="size-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{t[labelKey]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

export function MoreTextFormatMenu({
  onOpenChange,
  onDismiss,
}: {
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const formats = useFormatStateValue("formats");
  const fontSize = useFormatStateValue("fontSize");
  const textColor = useFormatStateValue("color");
  const backgroundColor = useFormatStateValue("backgroundColor");
  const isEditable = useLexicalEditable();
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const selectedRangeRef = useRef<RangeSelection | null>(null);
  const currentFontSize = Number.parseInt(fontSize, 10) || DEFAULT_FONT_SIZE;
  const [fontSizeInput, setFontSizeInput] = useState(String(currentFontSize));
  const inputSize = Number(fontSizeInput);
  const stepFontSize =
    Number.isInteger(inputSize) &&
    inputSize >= MIN_FONT_SIZE &&
    inputSize <= MAX_FONT_SIZE
      ? inputSize
      : currentFontSize;

  const rememberSelection = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      selectedRangeRef.current =
        $isRangeSelection(selection) && !selection.isCollapsed()
          ? selection.clone()
          : null;
    });
  };

  const applyStyle = (
    property: "font-size" | "color" | "background-color",
    value: string,
  ) => {
    const selectedRange = selectedRangeRef.current;
    if (!selectedRange) return;
    editor.update(() => {
      $setSelection(selectedRange.clone());
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        $patchStyleText(selection, { [property]: value });
        selectedRangeRef.current = selection.clone();
      }
    });
  };

  const applyTextFormat = (format: TextFormatType) => {
    const selectedRange = selectedRangeRef.current;
    if (!selectedRange) return;
    editor.update(() => {
      $setSelection(selectedRange.clone());
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selectedRangeRef.current = selection.clone();
      }
    });
  };

  const applyFontSize = (size: number) => {
    if (!Number.isInteger(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) {
      return;
    }
    setFontSizeInput(String(size));
    applyStyle("font-size", `${size}px`);
  };

  const keepFontSizeInputFocused = (input: HTMLInputElement, force = false) => {
    requestAnimationFrame(() => {
      if (!input.isConnected || document.activeElement === input) return;
      const activeElement = document.activeElement;
      const root = editor.getRootElement();
      const menu = input.closest('[data-slot="dropdown-menu-content"]');
      if (
        force ||
        activeElement === document.body ||
        activeElement === menu ||
        (root && activeElement && root.contains(activeElement))
      ) {
        input.focus({ preventScroll: true });
      }
    });
  };

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (open) {
          rememberSelection();
          setFontSizeInput(String(currentFontSize));
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isEditable}
          aria-label={t.moreFormatting}
          onMouseDown={(event) => {
            rememberSelection();
            event.preventDefault();
          }}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
          <span>{t.more}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-floating-format-menu=""
        align="end"
        sideOffset={8}
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        className="max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] w-60 overflow-y-auto overscroll-contain"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => {
          const root = editor.getRootElement();
          if (root && event.target instanceof Node && root.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <DropdownMenuLabel>{t.moreFormatting}</DropdownMenuLabel>
        {FORMAT_GROUPS.slice(1).map((group, index) => (
          <div key={index}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {group.map(({ format, labelKey, icon: Icon }) => (
              <DropdownMenuCheckboxItem
                key={format}
                checked={formats.includes(format)}
                onCheckedChange={() => {
                  applyTextFormat(format);
                  onDismiss?.();
                }}
              >
                <Icon />
                {t[labelKey]}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t.fontSizeTitle}</DropdownMenuLabel>
        <div className="flex items-center gap-1 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t.decreaseFontSize}
            disabled={stepFontSize <= MIN_FONT_SIZE}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => applyFontSize(Math.max(MIN_FONT_SIZE, stepFontSize - 2))}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            type="number"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={1}
            value={fontSizeInput}
            aria-label={t.fontSizeTitle}
            className="h-8 min-w-0 flex-1 px-2 text-center"
            onChange={(event) => {
              const value = event.target.value;
              setFontSizeInput(value);
              const size = Number(value);
              if (
                value !== "" &&
                Number.isInteger(size) &&
                size >= MIN_FONT_SIZE &&
                size <= MAX_FONT_SIZE
              ) {
                applyStyle("font-size", `${size}px`);
                keepFontSizeInputFocused(event.currentTarget);
              }
            }}
            onBlur={(event) => {
              const size = Number(event.target.value);
              if (
                !Number.isInteger(size) ||
                size < MIN_FONT_SIZE ||
                size > MAX_FONT_SIZE
              ) {
                setFontSizeInput(String(currentFontSize));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                event.stopPropagation();
                const input = event.currentTarget;
                const size = Number(input.value);
                const startingSize =
                  Number.isInteger(size) &&
                  size >= MIN_FONT_SIZE &&
                  size <= MAX_FONT_SIZE
                    ? size
                    : currentFontSize;
                const nextSize = Math.min(
                  MAX_FONT_SIZE,
                  Math.max(
                    MIN_FONT_SIZE,
                    startingSize + (event.key === "ArrowUp" ? 1 : -1),
                  ),
                );
                applyFontSize(nextSize);
                keepFontSizeInputFocused(input, true);
                return;
              }
              if (event.key !== "Escape") event.stopPropagation();
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t.increaseFontSize}
            disabled={stepFontSize >= MAX_FONT_SIZE}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => applyFontSize(Math.min(MAX_FONT_SIZE, stepFontSize + 2))}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Baseline className="size-4 shrink-0" />
            <span>{t.textColor}</span>
            <input
              type="color"
              aria-label={t.textColor}
              className="ml-auto size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
              value={/^#[0-9a-f]{6}$/i.test(textColor) ? textColor : "#000000"}
              onChange={(event) => {
                applyStyle("color", event.target.value);
                onDismiss?.();
              }}
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <PaintBucket className="size-4 shrink-0" />
            <span>{t.backgroundColor}</span>
            <input
              type="color"
              aria-label={t.backgroundColor}
              className="ml-auto size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
              value={
                /^#[0-9a-f]{6}$/i.test(backgroundColor)
                  ? backgroundColor
                  : "#ffff00"
              }
              onChange={(event) => {
                applyStyle("background-color", event.target.value);
                onDismiss?.();
              }}
            />
          </label>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (selectedRangeRef.current) {
              clearFormatting(editor, selectedRangeRef.current);
            }
            onDismiss?.();
          }}
        >
          <RemoveFormatting className="size-4" />
          {t.clearFormatting}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TextFormatToolbarPlugin({
  formats = "all",
}: {
  formats?: "basic" | "all";
}) {
  const groups =
    formats === "basic" ? FORMAT_GROUPS.slice(0, 1) : FORMAT_GROUPS;
  return (
    <>
      {groups.map((items, groupIndex) => (
        <FormatToggleGroup key={groupIndex} items={items} />
      ))}
    </>
  );
}
