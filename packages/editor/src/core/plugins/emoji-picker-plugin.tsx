"use client";

import { useCallback, useMemo, useState } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { createPortal } from "react-dom";

import { Command, CommandItem, CommandList } from "../../ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../ui/popover";

import { searchEmojis, type EmojiEntry } from "../lib/emoji-list";
import { useTranslation } from "../lib/locale";

const MAX_SUGGESTIONS = 8;

class EmojiTypeaheadOption extends MenuOption {
  entry: EmojiEntry;

  constructor(entry: EmojiEntry) {
    super(entry.id);
    this.entry = entry;
  }
}

export function insertEmojiTrigger(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection() ?? $getRoot().selectEnd();
    if ($isRangeSelection(selection)) {
      selection.insertText(":");
    }
  });
  editor.focus();
}

export function EmojiPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { dir } = useTranslation();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(":", {
    minLength: 0,
  });

  const options = useMemo(() => {
    if (queryString === null) {
      return [];
    }
    return searchEmojis(queryString)
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => new EmojiTypeaheadOption(entry));
  }, [queryString]);

  const onSelectOption = useCallback(
    (
      option: EmojiTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const emojiNode = $createTextNode(option.entry.emoji);
        if (nodeToReplace) {
          nodeToReplace.replace(emojiNode);
        }
        emojiNode.selectNext();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<EmojiTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElementRef.current && options.length > 0 ? (
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
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="w-auto overflow-hidden p-0"
            >
              <Command
                value={
                  selectedIndex === null
                    ? ""
                    : (options[selectedIndex]?.entry.id ?? "")
                }
                onValueChange={(nextValue) => {
                  const index = options.findIndex(
                    (option) => option.entry.id === nextValue,
                  );
                  if (index >= 0) {
                    setHighlightedIndex(index);
                  }
                }}
                shouldFilter={false}
              >
                <CommandList className="max-h-64 w-56">
                  {options.map((option) => (
                    <CommandItem
                      key={option.key}
                      ref={option.setRefElement}
                      value={option.entry.id}
                      onSelect={() => selectOptionAndCleanUp(option)}
                    >
                      <span aria-hidden>{option.entry.emoji}</span>
                      <span className="truncate">:{option.entry.name}:</span>
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null
      }
    />
  );
}
