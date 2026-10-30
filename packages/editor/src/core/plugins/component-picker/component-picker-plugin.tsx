import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  COMMAND_PRIORITY_CRITICAL,
  KEY_ESCAPE_COMMAND,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  TextNode,
} from "lexical";
import { createPortal } from "react-dom";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "../../../ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../ui/popover";

import { useTranslation, type Locale } from "../../lib/locale";
import { useFloatingCollisionBoundary } from "../floating/floating-utils";

const GROUPS = [
  "suggested",
  "basic",
  "lists",
  "media",
  "layout",
  "advanced",
  "format",
  "alignment",
  "tools",
] as const;

export type ComponentPickerGroup = (typeof GROUPS)[number];

const GROUP_LABEL_KEYS: Record<ComponentPickerGroup, keyof Locale> = {
  suggested: "slashSuggested",
  basic: "slashBasicBlocks",
  lists: "slashLists",
  media: "slashMedia",
  layout: "slashLayout",
  advanced: "slashAdvancedBlocks",
  format: "textFormatToolbar",
  alignment: "slashAlignment",
  tools: "slashTools",
};

const SUGGESTED_VALUES = [
  "ask-ai",
  "paragraph",
  "h1",
  "check-list",
  "image",
  "table",
] as const;

const ITEM_GROUPS: Record<string, ComponentPickerGroup> = {
  "ask-ai": "suggested",
  paragraph: "basic",
  h1: "basic",
  h2: "basic",
  h3: "basic",
  quote: "basic",
  pullquote: "basic",
  "numbered-list": "lists",
  "bulleted-list": "lists",
  "check-list": "lists",
  image: "media",
  video: "media",
  audio: "media",
  file: "media",
  youtube: "media",
  tweet: "media",
  table: "layout",
  "columns-one": "layout",
  "columns-two": "layout",
  "columns-three": "layout",
  divider: "layout",
  "code-block": "advanced",
  card: "advanced",
  collapsible: "advanced",
  review: "advanced",
  poll: "advanced",
  board: "advanced",
  equation: "advanced",
};

function groupFor(item: ComponentPickerItem): ComponentPickerGroup {
  if (item.group) return item.group;
  if (item.value.startsWith("table-")) return "layout";
  if (item.value.startsWith("datetime")) return "advanced";
  if (item.value.startsWith("toggle-h")) return "advanced";
  return ITEM_GROUPS[item.value] ?? "advanced";
}

export type ComponentPickerItem = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  group?: ComponentPickerGroup;
  keywords?: string[];
  onSelect: (queryString: string) => void;
};

type ComponentPickerContextValue = {
  registerItems: (id: string, items: ComponentPickerItem[]) => () => void;
  queryString: string | null;
};

const ComponentPickerContext =
  createContext<ComponentPickerContextValue | null>(null);

function useComponentPickerContext(): ComponentPickerContextValue {
  const context = useContext(ComponentPickerContext);
  if (context === null) {
    throw new Error(
      "ComponentPicker plugins must be rendered inside <ComponentPicker>",
    );
  }
  return context;
}

export function useComponentPickerQuery(): string | null {
  return useComponentPickerContext().queryString;
}

export function useComponentPickerItems(items: ComponentPickerItem[]) {
  const { registerItems } = useComponentPickerContext();
  const id = useId();

  useEffect(() => registerItems(id, items), [registerItems, id, items]);
}

class ComponentPickerOption extends MenuOption {
  item: ComponentPickerItem;

  constructor(item: ComponentPickerItem) {
    super(item.value);
    this.item = item;
  }
}

export function ComponentPicker({ children }: { children: React.ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const { dir, t } = useTranslation();
  const collisionBoundary = useFloatingCollisionBoundary(editor);
  const [queryString, setQueryString] = useState<string | null>(null);
  const [itemsById, setItemsById] = useState(
    () => new Map<string, { order: number; items: ComponentPickerItem[] }>(),
  );
  const registrationOrderRef = useRef(new Map<string, number>());

  const registerItems = useCallback(
    (id: string, items: ComponentPickerItem[]) => {
      const orders = registrationOrderRef.current;
      if (!orders.has(id)) {
        orders.set(id, orders.size);
      }
      const order = orders.get(id) ?? 0;
      setItemsById((prev) => new Map(prev).set(id, { order, items }));
      return () => {
        setItemsById((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      };
    },
    [],
  );

  const contextValue = useMemo(
    () => ({ registerItems, queryString }),
    [registerItems, queryString],
  );

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    allowWhitespace: true,
    minLength: 0,
  });

  // The menu opens only for a slash that was just written (typed, pasted, or
  // inserted by the block handle). Putting the caret back after an old
  // "/query", or typing on after the menu was dismissed, does not reopen it.
  const armedRef = useRef(false);

  useEffect(
    () =>
      // Transforms run only for text that changed in this update, so a caret
      // move alone never arms the menu.
      editor.registerNodeTransform(TextNode, (node) => {
        const selection = $getSelection();
        if (
          !$isRangeSelection(selection) ||
          !selection.isCollapsed() ||
          selection.anchor.type !== "text" ||
          selection.anchor.key !== node.getKey() ||
          selection.anchor.offset === 0
        ) {
          return;
        }
        if (node.getTextContent()[selection.anchor.offset - 1] === "/") {
          armedRef.current = true;
        }
      }),
    [editor],
  );

  const triggerFn = useCallback(
    (text: string, triggerEditor: LexicalEditor) => {
      const match = checkForTriggerMatch(text, triggerEditor);
      if (!match) {
        armedRef.current = false;
        return null;
      }
      return armedRef.current ? match : null;
    },
    [checkForTriggerMatch],
  );

  const disarm = useCallback(() => {
    armedRef.current = false;
  }, []);

  const options = useMemo(() => {
    const allItems = Array.from(itemsById.values())
      .sort((a, b) => a.order - b.order)
      .flatMap(({ items }) => items);
    const query = (queryString ?? "").trim().toLowerCase();
    const matches =
      query === ""
        ? [
            ...SUGGESTED_VALUES.flatMap((value) => {
              const item = allItems.find((candidate) => candidate.value === value);
              return item
                ? [{ ...item, value: `suggested-${value}`, group: "suggested" as const }]
                : [];
            }),
            ...allItems.filter((item) => item.value !== "ask-ai"),
          ]
        : allItems.filter(
            (item) =>
              item.label.toLowerCase().includes(query) ||
              (item.keywords ?? []).some((keyword) =>
                keyword.toLowerCase().includes(query),
              ),
          );
    return GROUPS.flatMap((group) =>
      matches
        .filter((item) => groupFor(item) === group)
        .map((item) => new ComponentPickerOption(item)),
    );
  }, [itemsById, queryString]);

  const onSelectOption = useCallback(
    (
      option: ComponentPickerOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        if (nodeToReplace) {
          nodeToReplace.remove();
        }
      });
      closeMenu();
      option.item.onSelect(matchingString);
    },
    [editor],
  );

  return (
    <ComponentPickerContext.Provider value={contextValue}>
      {children}
      <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
        onQueryChange={setQueryString}
        onSelectOption={onSelectOption}
        onClose={disarm}
        triggerFn={triggerFn}
        options={options}
        commandPriority={COMMAND_PRIORITY_CRITICAL}
        menuRenderFn={(
          anchorElementRef,
          { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
        ) =>
          anchorElementRef.current ? (
            <Popover open>
              {createPortal(
                <PopoverAnchor asChild>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-0"
                  />
                </PopoverAnchor>,
                anchorElementRef.current,
              )}
              <PopoverContent
                dir={dir}
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={8}
                collisionBoundary={collisionBoundary ?? undefined}
                sticky="partial"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-1rem))] max-w-(--radix-popover-content-available-width) min-h-0 flex-col overflow-hidden p-0"
              >
                <Command
                  value={
                    selectedIndex === null
                      ? ""
                      : (options[selectedIndex]?.item.value ?? "")
                  }
                  onValueChange={(nextValue) => {
                    const index = options.findIndex(
                      (option) => option.item.value === nextValue,
                    );
                    if (index >= 0) {
                      setHighlightedIndex(index);
                    }
                  }}
                  shouldFilter={false}
                  className="min-h-0 flex-1"
                >
                  <CommandList className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                    {options.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {t.noMatches}
                      </p>
                    ) : null}
                    {GROUPS.map((group) => {
                      const groupOptions = options.filter(
                        (option) => groupFor(option.item) === group,
                      );
                      return groupOptions.length > 0 ? (
                        <CommandGroup
                          key={group}
                          heading={t[GROUP_LABEL_KEYS[group]]}
                        >
                          {groupOptions.map((option) => (
                            <CommandItem
                              key={option.key}
                              ref={option.setRefElement}
                              value={option.item.value}
                              className="min-h-9 gap-3 px-3 py-2"
                              onSelect={() => selectOptionAndCleanUp(option)}
                            >
                              {option.item.icon}
                              <span className="min-w-0 flex-1 truncate">
                                {option.item.label}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : null;
                    })}
                  </CommandList>
                </Command>
                <div className="p-1.5 border-t">
                  <button
                    type="button"
                    className="flex rounded-md w-full shrink-0 items-center justify-between px-2.5 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor.dispatchCommand(
                        KEY_ESCAPE_COMMAND,
                        new KeyboardEvent("keydown", {
                          key: "Escape",
                          bubbles: true,
                          cancelable: true,
                        }),
                      );
                    }}
                  >
                    <span>{t.slashCloseMenu}</span>
                    <kbd className="text-xs text-muted-foreground">Esc</kbd>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null
        }
      />
    </ComponentPickerContext.Provider>
  );
}
