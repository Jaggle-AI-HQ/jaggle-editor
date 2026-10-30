"use client";

import { useEffect, useMemo, type RefObject } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Briefcase,
  CheckSquare,
  File,
  FileText,
  Flag,
  Target,
  Timer,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "../../ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../ui/popover";

import { useTranslation } from "../lib/locale";
import { useFloatingCollisionBoundary } from "../plugins/floating/floating-utils";
import type {
  MentionEntityType,
  MentionResult,
} from "../utils/search-mentions";

const GROUPS: { labelKey: "mentionPeople" | "mentionPages"; types: MentionEntityType[] }[] = [
  { labelKey: "mentionPeople", types: ["user"] },
  {
    labelKey: "mentionPages",
    types: ["document", "project", "task", "goal", "file", "report", "sprint"],
  },
];

const TYPE_LABEL: Record<MentionEntityType, string> = {
  user: "Person",
  document: "Document",
  project: "Project",
  task: "Task",
  goal: "Goal",
  file: "File",
  report: "Report",
  sprint: "Sprint",
};

const TYPE_ICON = {
  document: FileText,
  project: Briefcase,
  task: CheckSquare,
  goal: Target,
  file: File,
  report: Flag,
  sprint: Timer,
} as const;

function initials(title: string) {
  const parts = title.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function groupedItems(items: MentionResult[]) {
  return GROUPS.flatMap((group) => {
    const entries = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        (group.types as readonly string[]).includes(item.entityType),
      );
    return entries.length === 0 ? [] : [{ labelKey: group.labelKey, entries }];
  });
}

function itemValue(item: MentionResult) {
  return `${item.entityType}:${item.entityId}`;
}

function MentionGlyph({ item }: { item: MentionResult }) {
  if (item.entityType === "user") {
    return (
      <Avatar size="sm" className="size-5">
        {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt="" /> : null}
        <AvatarFallback seed={item.entityId}>
          {initials(item.title)}
        </AvatarFallback>
      </Avatar>
    );
  }
  const Icon = TYPE_ICON[item.entityType];
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}

export function MentionMenu({
  items,
  isLoading,
  selectedIndex,
  position,
  getAnchor,
  selectedRef,
  onHover,
  onSelect,
  onClose,
  constrainToEditor = false,
}: {
  items: MentionResult[];
  isLoading: boolean;
  selectedIndex: number;
  position: { top: number; left: number };
  /** Live position of the trigger; measured every frame while the menu is open. */
  getAnchor?: () => { top: number; left: number } | null;
  selectedRef: RefObject<HTMLDivElement | null>;
  onHover: (index: number) => void;
  onSelect: (item: MentionResult) => void;
  onClose: () => void;
  constrainToEditor?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const { t, dir } = useTranslation();
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const groups = groupedItems(items);
  // A virtual anchor in viewport coordinates. A fixed-position element would
  // be offset inside transformed ancestors such as the comment composer's
  // popover. It is measured live, so the menu follows the trigger through
  // popover animations, scrolling, and reflow.
  const caretAnchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          const anchor = getAnchor?.() ?? position;
          return DOMRect.fromRect({ x: anchor.left, y: anchor.top, width: 0, height: 0 });
        },
      },
    }),
    [getAnchor, position],
  );

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, selectedRef]);

  return (
    <Popover open>
      <PopoverAnchor virtualRef={caretAnchor} />
      <PopoverContent
        data-lexical-mention-menu=""
        dir={dir}
        side="bottom"
        align="start"
        sideOffset={2}
        updatePositionStrategy="always"
        collisionPadding={8}
        collisionBoundary={constrainToEditor ? (collisionBoundary ?? undefined) : undefined}
        sticky="partial"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        aria-label={t.mentionSuggestions}
        className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-1rem))] max-w-(--radix-popover-content-available-width) min-h-0 flex-col overflow-hidden p-0"
      >
        <Command
          value={items[selectedIndex] ? itemValue(items[selectedIndex]) : ""}
          onValueChange={(value) => {
            const index = items.findIndex((item) => itemValue(item) === value);
            if (index >= 0) onHover(index);
          }}
          shouldFilter={false}
          className="min-h-0 flex-1"
        >
          <CommandList className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {isLoading ? t.mentionSearching : t.noMatches}
              </p>
            ) : (
              groups.map((group) => (
                <CommandGroup key={group.labelKey} heading={t[group.labelKey]}>
                  {group.entries.map(({ item, index }) => (
                    <CommandItem
                      key={itemValue(item)}
                      ref={index === selectedIndex ? selectedRef : undefined}
                      value={itemValue(item)}
                      className="min-h-9 gap-3 px-3 py-2"
                      onMouseEnter={() => onHover(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => onSelect(item)}
                    >
                      <MentionGlyph item={item} />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.entityType === "user" ? null : (
                        <span className="max-w-20 shrink-0 truncate text-xs text-muted-foreground">
                          {TYPE_LABEL[item.entityType]}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
        <div className="border-t p-1.5">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClose}
          >
            <span>{t.slashCloseMenu}</span>
            <kbd className="text-xs text-muted-foreground">Esc</kbd>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
