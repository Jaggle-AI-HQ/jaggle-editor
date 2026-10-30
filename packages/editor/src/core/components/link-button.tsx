"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { $isLinkNode, $toggleLink } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  type RangeSelection,
} from "lexical";
import { LinkIcon } from "lucide-react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import { cn } from "../../lib/utils";

import { OPEN_LINK_COMMAND } from "../lib/commands";
import { normalizeLinkUrl } from "../utils/link-url";

function $selectedLinkUrl() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return "";
  const node = selection.anchor.getNode();
  const link = $isLinkNode(node) ? node : $findMatchingParent(node, $isLinkNode);
  return link && $isLinkNode(link) ? link.getURL() : "";
}

export function LinkButton({ active }: { active: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [existing, setExisting] = useState("");
  const savedSelection = useRef<RangeSelection | null>(null);

  const captureSelection = useCallback(() => {
    editor.read(() => {
      const selection = $getSelection();
      savedSelection.current = $isRangeSelection(selection)
        ? selection.clone()
        : null;
      const current = $selectedLinkUrl();
      setExisting(current);
      setUrl(current);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      OPEN_LINK_COMMAND,
      () => {
        captureSelection();
        setOpen(true);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [captureSelection, editor]);

  const apply = (nextUrl: string | null) => {
    editor.focus(() => {
      editor.update(() => {
        const selection = savedSelection.current;
        if (selection) $setSelection(selection.clone());
        $toggleLink(nextUrl);
      });
    });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) captureSelection();
        setOpen(next);
      }}
    >
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Link"
              className={cn(
                (active || open) && "bg-accent text-accent-foreground",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                captureSelection();
              }}
            >
              <LinkIcon />
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent>Link (⌘K)</TooltipContent>
      </Tooltip>
      {open ? (
        <PopoverContent align="start" className="w-72 space-y-2 p-3">
          <Input
            autoFocus
            value={url}
            placeholder="https://"
            aria-label="Link URL"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const next = normalizeLinkUrl(url);
                if (next) apply(next);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                editor.focus();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            {existing ? (
              <>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={existing} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => apply(null)}
                >
                  Remove
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!normalizeLinkUrl(url)}
              onClick={() => apply(normalizeLinkUrl(url))}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
