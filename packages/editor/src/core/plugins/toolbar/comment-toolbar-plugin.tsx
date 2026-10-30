
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "../../../ui/button";
import { ButtonGroup } from "../../../ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../ui/tooltip";

import { useDocumentUi } from "../../document/ui-context";
import { INSERT_INLINE_COMMAND } from "../../extensions/comment";
import { useTranslation } from "../../lib/locale";

export function CommentToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { showComments, openComments } = useDocumentUi();

  if (!showComments) {
    return null;
  }

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.addComment}
            disabled={!isEditable}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              openComments();
              editor.dispatchCommand(INSERT_INLINE_COMMAND, undefined);
            }}
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.addComment}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
