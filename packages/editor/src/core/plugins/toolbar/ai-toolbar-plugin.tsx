import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { Sparkles } from "lucide-react";

import { Button } from "../../../ui/button";
import { ButtonGroup } from "../../../ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";

import { useDocumentUi } from "../../document/ui-context";
import { useTranslation } from "../../lib/locale";

/**
 * Kept between the anchor and the edge of the visible area. Larger than the
 * popover's 8px collision padding, which counts an anchor that close to the
 * edge as clipped and hides the menu.
 */
const EDGE_MARGIN = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * The part of the screen where the selection can be seen: the viewport,
 * narrowed to the nearest scrolling container (the editor column, or a page
 * that scrolls below an app header).
 */
function visibleArea(node: Node | null) {
  let top = 0;
  let bottom = window.innerHeight;
  let left = 0;
  let right = window.innerWidth;
  for (
    let element = node instanceof Element ? node : (node?.parentElement ?? null);
    element;
    element = element.parentElement
  ) {
    const { overflowY } = getComputedStyle(element);
    if (overflowY === "auto" || overflowY === "scroll") {
      const rect = element.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
      break;
    }
  }
  return { top, bottom, left, right };
}

/** The caret-sized rect at the selection's focus: the end the user dragged or arrowed to. */
function focusRect(selection: Selection): DOMRect | null {
  if (!selection.focusNode) return null;
  const range = document.createRange();
  try {
    range.setStart(selection.focusNode, selection.focusOffset);
    range.collapse(true);
  } catch {
    return null;
  }
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  // A collapsed range between elements can measure as an empty rect at 0,0.
  return rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0
    ? null
    : rect;
}

/**
 * Where the AI menu opens: under the selection's focus, which is on screen
 * even when the selection is taller than the viewport (its overall bottom
 * may not be). Clamped into the visible area so the menu always shows; the
 * popover hides itself when its anchor is clipped.
 */
export function selectionAnchor() {
  const selection = window.getSelection();
  const rect =
    selection && selection.rangeCount > 0
      ? (focusRect(selection) ?? selection.getRangeAt(0).getBoundingClientRect())
      : null;
  const area = visibleArea(selection?.focusNode ?? null);
  return {
    top: clamp((rect?.bottom ?? 80) + 8, area.top + EDGE_MARGIN, area.bottom - EDGE_MARGIN),
    left: clamp(rect?.left ?? 16, area.left + EDGE_MARGIN, area.right - EDGE_MARGIN),
  };
}

export function AiToolbarPlugin() {
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { openAi } = useDocumentUi();

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.askAi}
            disabled={!isEditable}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              openAi(selectionAnchor());
            }}
          >
            <Sparkles className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.askAi}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
