import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { Link as LinkIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "../../../ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";
import { cn } from "../../../lib/utils";

import { toolbarPressedClass } from "../../components/toolbar-button";
import { useFormatStateValue } from "../../extensions/format-state";
import { OPEN_LINK_EDITOR_COMMAND } from "../../extensions/link";
import { useTranslation } from "../../lib/locale";

export function LinkToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const isLink = useFormatStateValue("isLink");

  return (
    <ToggleGroup
      type="multiple"
      variant="default"
      size="sm"
      spacing={1}
      disabled={!isEditable}
      value={isLink ? ["link"] : []}
      onValueChange={() => {
        if (isLink) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        } else {
          editor.dispatchCommand(OPEN_LINK_EDITOR_COMMAND, undefined);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="link"
            aria-label={t.insertLink}
            className={cn(toolbarPressedClass(isLink))}
            onMouseDown={(event) => event.preventDefault()}
          >
            <LinkIcon className="size-4.5" />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>{t.insertLink}</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
